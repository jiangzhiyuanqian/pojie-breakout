import json, os, sys, glob

CANDS = [
    r"C:\Users\qianx\.dsh\storages",
    r"C:\Users\qianx\.dsh\logs",
    r"C:\Users\qianx\AppData\Roaming\@deepseek-ai",
    r"C:\Users\qianx\.dsh\data",
]

hits = []
for root in CANDS:
    if not os.path.isdir(root):
        continue
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d not in ("node_modules", "cache", "attachments")]
        for f in fn:
            p = os.path.join(dp, f)
            if not f.endswith((".jsonl", ".json")):
                continue
            try:
                st = os.stat(p)
            except OSError:
                continue
            if st.st_size < 50000:
                continue
            hits.append((st.st_mtime, st.st_size, p))
hits.sort(reverse=True)
print("candidates:", len(hits))
for m, s, p in hits[:12]:
    print("  %10d  %s" % (s, p))

def est(txt):
    # 粗略：CJK 按 1 字 ≈ 1 token，其余按 4 字符 ≈ 1 token
    cjk = sum(1 for c in txt if "\u4e00" <= c <= "\u9fff")
    return int(cjk + (len(txt) - cjk) / 4.0)

def scan(path):
    out = []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for i, line in enumerate(fh):
                line = line.strip()
                if not line or not line.startswith("{"):
                    continue
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                if not isinstance(o, dict):
                    continue
                # 找 tools 数组
                tools = o.get("tools")
                if tools is None:
                    for k in ("body", "request", "payload", "messages"):
                        v = o.get(k)
                        if isinstance(v, dict):
                            tools = v.get("tools")
                            if tools:
                                break
                if not tools:
                    continue
                tsys = ""
                for k in ("system", "systemPrompt"):
                    if isinstance(o.get(k), str):
                        tsys = o[k]
                if not tsys:
                    b = o.get("body")
                    if isinstance(b, dict):
                        for m2 in b.get("messages", []) or []:
                            if isinstance(m2, dict) and m2.get("role") == "system":
                                tsys = str(m2.get("content", ""))
                names = []
                tchars = 0
                for t in tools:
                    if isinstance(t, dict):
                        names.append(t.get("function", {}).get("name", "?"))
                        tchars += len(json.dumps(t, ensure_ascii=False))
                out.append({
                    "line": i,
                    "n_tools": len(tools),
                    "tool_chars": tchars,
                    "tool_est": est(json.dumps(tools, ensure_ascii=False)),
                    "sys_chars": len(tsys),
                    "sys_est": est(tsys),
                    "total_est": est(json.dumps(o, ensure_ascii=False)),
                    "names": names,
                })
                if len(out) >= 3:
                    break
    except Exception as e:
        return [{"err": str(e)[:200]}]
    return out

print("\n=== scan for tool arrays ===")
for m, s, p in hits[:12]:
    r = scan(p)
    if r and "err" not in r[0]:
        for row in r[:1]:
            print("\nFILE:", p)
            print("  n_tools=%d  tool_est=%d tok  sys_est=%d tok  row_total_est=%d tok"
                  % (row["n_tools"], row["tool_est"], row["sys_est"], row["total_est"]))
            with open(r"C:\python编程库\游戏尝试\_toolnames.txt", "w", encoding="utf-8") as o:
                for n in row["names"]:
                    o.write(n + "\n")
            print("  names -> _toolnames.txt")
