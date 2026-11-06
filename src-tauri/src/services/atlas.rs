use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AtlasFile { pub path: String, pub ext: Option<String>, pub lines: usize, pub symbols: Vec<String>, pub imports: Vec<String> }

fn is_code_ext(ext: &str) -> bool { matches!(ext, "rs"|"ts"|"tsx"|"js"|"jsx"|"mjs"|"cjs"|"py"|"go"|"java"|"c"|"h"|"cpp"|"hpp"|"cs"|"rb"|"php"|"vue"|"svelte") }
fn ignored(name: &str) -> bool { matches!(name, "node_modules"|".git"|"target"|"dist"|"build"|".next"|"out"|"vendor"|".idea"|".vscode") }

fn walk(dir: &Path, out: &mut Vec<PathBuf>, depth: usize) {
    if depth > 8 || out.len() >= 1200 { return; }
    let Ok(rd) = fs::read_dir(dir) else { return; };
    for e in rd.flatten() {
        let p = e.path();
        let name = e.file_name().to_string_lossy().to_string();
        if ignored(&name) || name.starts_with('.') && name != ".env" { continue; }
        if p.is_dir() { walk(&p, out, depth + 1); }
        else if p.is_file() {
            if let Some(ext) = p.extension().and_then(|s| s.to_str()) { if is_code_ext(ext) { out.push(p); } }
        }
        if out.len() >= 1200 { break; }
    }
}

fn extract_symbols(ext: &str, text: &str) -> Vec<String> {
    let mut out = Vec::new();
    for line in text.lines().take(4000) {
        let t = line.trim();
        let cand = match ext {
            "rs" => t.strip_prefix("pub fn ").or_else(|| t.strip_prefix("fn ")).or_else(|| t.strip_prefix("pub struct ")).or_else(|| t.strip_prefix("struct ")).or_else(|| t.strip_prefix("pub enum ")).or_else(|| t.strip_prefix("enum ")).or_else(|| t.strip_prefix("pub trait ")).or_else(|| t.strip_prefix("trait ")),
            "ts"|"tsx"|"js"|"jsx"|"mjs"|"cjs" => t.strip_prefix("export function ").or_else(|| t.strip_prefix("function ")).or_else(|| t.strip_prefix("export class ")).or_else(|| t.strip_prefix("class ")).or_else(|| t.strip_prefix("export interface ")).or_else(|| t.strip_prefix("interface ")).or_else(|| t.strip_prefix("export type ")).or_else(|| t.strip_prefix("type ")).or_else(|| t.strip_prefix("export const ")).or_else(|| t.strip_prefix("const ")),
            "py" => t.strip_prefix("def ").or_else(|| t.strip_prefix("class ")),
            "go" => t.strip_prefix("func ").or_else(|| t.strip_prefix("type ")),
            _ => None,
        };
        if let Some(c) = cand {
            let name: String = c.chars().take_while(|ch| ch.is_alphanumeric() || *ch=='_' || *ch=='$').collect();
            if name.len() >= 2 && out.len() < 40 { out.push(name); }
        }
    }
    out
}
fn extract_imports(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    for line in text.lines().take(250) {
        let t = line.trim();
        if (t.starts_with("import ") || t.starts_with("from ") || t.starts_with("use ") || t.starts_with("#include") || t.starts_with("require(")) && out.len() < 30 {
            out.push(t.chars().take(140).collect());
        }
    }
    out
}

#[derive(Deserialize)]
pub struct AtlasReq { pub workspace: String, pub query: Option<String>, pub limit: Option<usize> }

#[tauri::command]
pub async fn atlas_index(req: AtlasReq) -> Result<Value, String> {
    let root = Path::new(&req.workspace);
    if !root.is_dir() { return Err(format!("workspace is not a directory: {}", req.workspace)); }
    let mut files = Vec::new(); walk(root, &mut files, 0);
    let mut out: Vec<AtlasFile> = Vec::new();
    let mut ext_counts: HashMap<String, usize> = HashMap::new();
    let q = req.query.unwrap_or_default().to_lowercase();
    for p in files {
        let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
        *ext_counts.entry(ext.clone()).or_default() += 1;
        let Ok(meta) = fs::metadata(&p) else { continue; };
        if meta.len() > 400_000 { continue; }
        let Ok(text) = fs::read_to_string(&p) else { continue; };
        let symbols = extract_symbols(&ext, &text);
        let imports = extract_imports(&text);
        let path = p.to_string_lossy().to_string();
        let hay = format!("{} {} {}", path.to_lowercase(), symbols.join(" ").to_lowercase(), imports.join(" ").to_lowercase());
        if !q.is_empty() && !hay.contains(&q) { continue; }
        out.push(AtlasFile { path, ext: if ext.is_empty(){None}else{Some(ext)}, lines: text.lines().count(), symbols, imports });
        if out.len() >= req.limit.unwrap_or(120).clamp(10, 500) { break; }
    }
    Ok(json!({"workspace": req.workspace, "indexed_files": out.len(), "ext_counts": ext_counts, "query": q, "files": out, "scope":"Bounded local heuristic index (no embeddings/cloud). Ignored common build/vendor dirs; capped file count/size."}))
}

#[tauri::command]
pub async fn atlas_impact(req: AtlasReq) -> Result<Value, String> {
    let idx = atlas_index(AtlasReq { workspace: req.workspace.clone(), query: req.query.clone(), limit: Some(300) }).await?;
    let needle = req.query.unwrap_or_default();
    let files = idx.get("files").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let mut import_hits = Vec::new();
    let symbol_hits = files.clone();
    if !needle.trim().is_empty() {
        let n = needle.to_lowercase();
        for f in &files {
            let imports = f.get("imports").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            if imports.iter().any(|i| i.as_str().unwrap_or("").to_lowercase().contains(&n)) {
                import_hits.push(f.clone());
            }
        }
    }
    let mut uniq = HashSet::new();
    let mut related = Vec::new();
    for f in symbol_hits.into_iter().chain(import_hits.into_iter()) {
        if let Some(p) = f.get("path").and_then(|v| v.as_str()) { if uniq.insert(p.to_string()) { related.push(f); } }
    }
    Ok(json!({"workspace": req.workspace, "target": needle, "related_files": related.into_iter().take(120).collect::<Vec<_>>(), "note":"Heuristic local impact radius from file paths/symbols/import lines. Verify with tests/search before refactors."}))
}
