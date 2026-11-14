import json, os, time, re

def est(t):
    cjk = sum(1 for c in t if "\u4e00" <= c <= "\u9fff")
    return int(cjk + (len(t) - cjk) / 4.0)

# ---------- 1. skills 目录：name + description 才是注入到提示里的部分 ----------
sk_dir = r"C:\Users\qianx\.dsh\skills"
sk_chars, sk_list = 0, []
if os.path.isdir(sk_dir):
    for dp, dn, fn in os.walk(sk_dir):
        for f in fn:
            if f != "SKILL.md":
                continue
            p = os.path.join(dp, f)
            try:
                txt = open(p, "r", encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            m = re.match(r"^---\r?\n(.*?)\r?\n---", txt, re.S)
            if not m:
                continue
            fm = m.group(1)
            name = re.search(r"^name:\s*(.+)$", fm, re.M)
            desc = re.search(r"^description:\s*(.+?)(?=\n\w+:|\Z)", fm, re.M | re.S)
            blob = (name.group(1) if name else "") + "\n" + (desc.group(1) if desc else "")
            sk_chars += len(blob)
            sk_list.append((len(blob), name.group(1) if name else "?"))
sk_list.sort(reverse=True)
print("=== SKILLS (%d 个) ===" % len(sk_list))
print("  name+description 合计 %d 字符 ≈ %d token" % (sk_chars, est("x" * sk_chars)))
for n, nm in sk_list[:6]:
    print("    %6d  %s" % (n, nm))

# ---------- 2. 找带 tools 数组的请求日志 ----------
ROOTS = [r"C:\Users\qianx\.dsh", r"C:\Users\qianx\AppData\Roaming\@deepseek-ai"]
cutoff = time.time() - 2 * 86400
found = []
for root in ROOTS:
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d not in ("node_modules", "attachments", "images", "cache", "skills")]
        for f in fn:
            if not f.endswith((".jsonl", ".json", ".log")):
                continue
            p = os.path.join(dp, f)
            try:
                st = os.stat(p)
            except OSError:
                continue
            if st.st_size < 20000 or st.st_mtime < cutoff:
                continue
            try:
                with open(p, "r", encoding="utf-8", errors="replace") as fh:
                    head = fh.read(400000)
            except OSError:
                continue
            if '"tools"' in head or '"function"' in head:
                found.append((st.st_size, p))
found.sort(reverse=True)
print("\n=== 含 tools 字段的文件 (近 2 天, >20KB) ===")
for s, p in found[:10]:
    print("  %10d  %s" % (s, p))

# ---------- 3. 从找到的文件里解析出 tools 数组 ----------
def parse_tools(path):
    best = None
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for i, line in enumerate(fh):
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                o = json.loads(line)
            except Exception:
                continue
            if not isinstance(o, dict):
                continue
            tools = o.get("tools")
            if tools is None:
                for k in ("body", "request", "payload"):
                    v = o.get(k)
                    if isinstance(v, dict) and v.get("tools"):
                        tools = v["tools"]
                        break
            if not isinstance(tools, list) or not tools:
                continue
            blob = json.dumps(tools, ensure_ascii=False)
            sysb = ""
            for m in o.get("messages", []) or []:
                if isinstance(m, dict) and m.get("role") == "system":
                    sysb = str(m.get("content", ""))
            cand = (len(blob), len(tools), blob, sysb)
            if best is None or cand[0] > best[0]:
                best = cand
    return best

for s, p in found[:4]:
    r = parse_tools(p)
    if not r:
        continue
    blob, n, sysb = r[2], r[1], r[3]
    print("\nFILE:", p)
    print("  tools 条数 = %d   tools JSON = %d 字符 ≈ %d token" % (n, len(blob), est(blob)))
    print("  system 提示 = %d 字符 ≈ %d token" % (len(sysb), est(sysb)))
    names = []
    try:
        for t in json.loads(blob):
            if isinstance(t, dict):
                fn_ = t.get("function", {})
                names.append((len(json.dumps(t, ensure_ascii=False)), fn_.get("name", "?")))
    except Exception:
        pass
    names.sort(reverse=True)
    with open(r"G:\python编程库\游戏尝试\_toolnames.txt", "w", encoding="utf-8") as o:
        for c, nm in names:
            o.write("%7d  %s\n" % (c, nm))
    print("  前 12 个最肥的工具 schema:")
    for c, nm in names[:12]:
        print("      %7d  %s" % (c, nm))
    print("  合计写入 _toolnames.txt (%d 条)" % len(names))
    break

# ---------- 4. 已启用的 MCP / 插件 ----------
print("\n=== cordis 插件清单里的 mcp 相关 ===")
for cp in [r"C:\Users\qianx\.dsh\profiles\desktop\cordis.patch.yml", r"C:\Users\qianx\.dsh\profiles\desktop\cordis.yml"]:
    if os.path.exists(cp):
        txt = open(cp, "r", encoding="utf-8", errors="replace").read()
        for line in txt.splitlines():
            if "mcp" in line.lower() or "rea" in line.lower() or "craft" in line.lower():
                print("   [%s] %s" % (os.path.basename(cp), line.strip()[:160]))
