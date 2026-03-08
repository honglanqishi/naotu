'use client';

import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

/**
 * 父子层级连接线。
 * 设计稿（Figma node 9:441）：紫色 #C026D3，strokeWidth 2，
 * S 形贝塞尔曲线（cubic bezier，X 中点为控制点），带紫色 glow 发光。
 */
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
  const [edgePath] = getBezierPath({
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
        stroke: '#C026D3',
        strokeWidth: 2,
        filter: 'drop-shadow(0px 0px 3px rgba(192,38,211,0.8))',
        ...style,
      }}
    />
  );
}
