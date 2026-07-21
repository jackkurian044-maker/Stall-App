import React, { useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Radar as RadarIcon } from "lucide-react";
import { CATEGORY_COLORS, COLORS } from "./constants";

export default function RadarChart({ radarData, radiusKm, onSelect }) {
  const rings = useMemo(() => {
    const step = radiusKm / 3;
    return [step, step * 2, step * 3].map((n) => Math.round(n * 100) / 100);
  }, [radiusKm]);

  return (
    <div className="stall-panel" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        <RadarIcon size={14} /> Proximity radar
      </div>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>
        you are the center · rings mark distance in km
      </div>

      <div className="radar-scope">
        <div className="radar-sweep" />
        <div style={{ position: "absolute", inset: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis type="number" dataKey="x" domain={[-radiusKm * 1.1, radiusKm * 1.1]} hide />
              <YAxis type="number" dataKey="y" domain={[-radiusKm * 1.1, radiusKm * 1.1]} hide />
              <ZAxis range={[64, 64]} />
              <Tooltip
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const d = payload[0].payload;
                  if (d.distance == null) return null;
                  return (
                    <div style={{ background: COLORS.ink, color: "#fff", padding: "6px 10px", borderRadius: 20, fontSize: 12, border: `1px solid ${COLORS.marigold}` }}>
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div className="font-mono" style={{ fontSize: 11 }}>
                        {d.distance.toFixed(2)} km · {d.category}
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={[{ x: 0, y: 0 }]} fill={COLORS.marigold} shape="circle" />
              <Scatter data={radarData} onClick={(d) => onSelect?.(d.id)} shape="circle" cursor="pointer">
                {radarData.map((d, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[d.category] || COLORS.marigold} stroke="#EDEEE6" strokeWidth={1.5} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-around", fontSize: 10, color: "#777", marginTop: 8 }}>
        {rings.map((r) => (
          <span key={r} className="font-mono">{r} km</span>
        ))}
      </div>
    </div>
  );
}
