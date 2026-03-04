'use client';

import { BaseEdge, getBezierPath, getStraightPath, type EdgeProps } from '@xyflow/react';

/** 父子层级连接线：水平时用直线，其余用贝塞尔曲线，无箭头 */
export function HierarchyEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  // 源目标 Y 几乎相同（单子节点水平直连）→ 用直线，避免出现微曲
  const isHorizontal = Math.abs(sourceY - targetY) < 3;
  const [edgePath] = isHorizontal
    ? getStraightPath({ sourceX, sourceY, targetX, targetY })
    : getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: 'var(--primary)',
        strokeWidth: 2,
        strokeOpacity: 0.7,
        ...style,
      }}
    />
  );
}
