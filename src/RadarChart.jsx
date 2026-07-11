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
    <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 16 }}>
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
      <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
        you are the center · rings mark distance in km
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <XAxis type="number" dataKey="x" domain={[-radiusKm * 1.1, radiusKm * 1.1]} hide />
          <YAxis type="number" dataKey="y" domain={[-radiusKm * 1.1, radiusKm * 1.1]} hide />
          <ZAxis range={[70, 70]} />
          <Tooltip
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              const d = payload[0].payload;
              if (d.distance == null) return null;
              return (
                <div style={{ background: COLORS.ink, color: "#fff", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                  <div className="font-mono" style={{ fontSize: 11 }}>
                    {d.distance.toFixed(2)} km · {d.category}
                  </div>
                </div>
              );
            }}
          />
          <Scatter data={[{ x: 0, y: 0 }]} fill={COLORS.ink} shape="circle" />
          <Scatter data={radarData} onClick={(d) => onSelect?.(d.id)} shape="circle" cursor="pointer">
            {radarData.map((d, i) => (
              <Cell key={i} fill={CATEGORY_COLORS[d.category] || COLORS.ink} stroke={COLORS.ink} strokeWidth={1} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", justifyContent: "space-around", fontSize: 10, color: "#777", marginTop: -4 }}>
        {rings.map((r) => (
          <span key={r} className="font-mono">{r} km</span>
        ))}
      </div>
    </div>
  );
}
