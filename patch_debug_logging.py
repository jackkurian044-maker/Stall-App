import sys

path = "src/AdminDashboard.jsx"

with open(path, "r") as f:
    content = f.read()

old_agents = '''  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => {
      setAgents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);'''

new_agents = '''  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => {
      console.log("agents snapshot:", snap.docs.length, "docs");
      setAgents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("agents listener error:", err.code, err.message);
    });
    return unsub;
  }, []);'''

old_commissions = '''  useEffect(() => {
    const unsub = onSnapshot(collection(db, "commissions"), (snap) => {
      setCommissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);'''

new_commissions = '''  useEffect(() => {
    const unsub = onSnapshot(collection(db, "commissions"), (snap) => {
      console.log("commissions snapshot:", snap.docs.length, "docs");
      setCommissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("commissions listener error:", err.code, err.message);
    });
    return unsub;
  }, []);'''

if old_agents not in content:
    print("ERROR: agents block not found — file may have changed. No changes made.")
    sys.exit(1)
if old_commissions not in content:
    print("ERROR: commissions block not found — file may have changed. No changes made.")
    sys.exit(1)

content = content.replace(old_agents, new_agents)
content = content.replace(old_commissions, new_commissions)

with open(path, "w") as f:
    f.write(content)

print("Patched successfully:", path)
