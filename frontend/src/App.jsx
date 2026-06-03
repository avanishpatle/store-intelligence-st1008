import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "/api";
const STORE = "ST1008";
const DAY = "2026-04-10";

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [error, setError] = useState(null);
  const [updated, setUpdated] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [m, f] = await Promise.all([
          fetch(`${API}/stores/${STORE}/metrics?day=${DAY}`),
          fetch(`${API}/stores/${STORE}/funnel?day=${DAY}`),
        ]);
        if (!m.ok) throw new Error(`metrics ${m.status}`);
        setMetrics(await m.json());
        if (f.ok) setFunnel(await f.json());
        setError(null);
        setUpdated(new Date().toLocaleTimeString());
      } catch (e) {
        setError(e.message);
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app">
      <h1>Store Intelligence</h1>
      <p className="sub">
        Brigade Bangalore ({STORE}) — live metrics · {DAY}
      </p>

      {error && <p className="error">API: {error} — start backend on port 8000</p>}

      {metrics && (
        <div className="grid">
          <div className="card">
            <div className="label">Unique visitors</div>
            <div className="value">{metrics.unique_visitors}</div>
          </div>
          <div className="card">
            <div className="label">Conversion rate</div>
            <div className="value">{(metrics.conversion_rate * 100).toFixed(1)}%</div>
          </div>
          <div className="card">
            <div className="label">Queue depth</div>
            <div className="value">{metrics.queue_depth}</div>
          </div>
          <div className="card">
            <div className="label">Abandonment</div>
            <div className="value">{(metrics.abandonment_rate * 100).toFixed(1)}%</div>
          </div>
        </div>
      )}

      {funnel && (
        <div className="funnel">
          <h2>Conversion funnel</h2>
          <div className="funnel-bar">
            {funnel.stages.map((s) => (
              <div key={s.stage} className="stage">
                <strong>{s.stage}</strong>
                <div>{s.count}</div>
                {s.drop_off_pct != null && (
                  <small>drop {s.drop_off_pct}%</small>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="status">
        {updated ? `Last refresh: ${updated} (every 2s)` : "Loading…"}
      </p>
    </div>
  );
}
