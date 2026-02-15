import { makePath } from "./LiveEdge";
import type { EdgeRouter } from "../types/types";

export const bezierEdgeRouter: EdgeRouter = (source, target) => makePath(source, target);

export const smoothStepEdgeRouter: EdgeRouter = (source, target) => {
  const midX = source.x + (target.x - source.x) / 2;
  return `M ${source.x} ${source.y} L ${midX} ${source.y} L ${midX} ${target.y} L ${target.x} ${target.y}`;
};

