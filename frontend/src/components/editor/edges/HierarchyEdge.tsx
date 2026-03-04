'use client';

import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';

/**
 * 父子层级连接线。1 个子节点时与父节点 y 相同，始终用直线。
 * 多子节点时 y 坐标不同，小角度斜线待用；为避免贝塞尔阈値问题，统一用直线。
 * 背景：贝塞尔曲线在不同高度节点间会因 handle Y 偏移差满足阈値而错误彯曲。
 */
export function HierarchyEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

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
