import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makePath, createLiveEdge, updateLiveEdge, removeLiveEdge, clearPathCache } from './LiveEdge';

describe('LiveEdge', () => {
  describe('makePath', () => {
    it('should create a cubic bezier path between two points', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 100 };

      const path = makePath(start, end);

      expect(path).toMatch(/^M0,0/);
      expect(path).toMatch(/100,100$/);
      expect(path).toContain('C');
    });

    it('should handle same start and end point', () => {
      const point = { x: 50, y: 50 };
      const path = makePath(point, point);

      expect(path).toBe('M50,50 C50,50 50,50 50,50');
    });

    it('should handle negative coordinates', () => {
      const start = { x: -50, y: -100 };
      const end = { x: 50, y: 100 };

      const path = makePath(start, end);

      expect(path).toContain('-50,-100');
      expect(path).toContain('50,100');
    });

    it('should create smooth curve for horizontal movement', () => {
      const start = { x: 0, y: 50 };
      const end = { x: 200, y: 50 };

      const path = makePath(start, end);

      // For horizontal movement, the control points should be offset horizontally
      expect(path).toMatch(/M0,50 C\d+,50 \d+,50 200,50/);
    });

    it('should create smooth curve for vertical movement', () => {
      const start = { x: 50, y: 0 };
      const end = { x: 50, y: 200 };

      const path = makePath(start, end);

      // Control points should still use horizontal offset
      expect(path).toBe('M50,0 C50,0 50,200 50,200');
    });

    it('should calculate control point offset as half the horizontal distance', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };

      const path = makePath(start, end);

      // dx = |100 - 0| * 0.5 = 50
      // Control points should be (0+50, 0) and (100-50, 0)
      expect(path).toBe('M0,0 C50,0 50,0 100,0');
    });

    it('should return cached result for same inputs (memoization)', () => {
      clearPathCache();
      const start = { x: 10, y: 20 };
      const end = { x: 110, y: 120 };

      const path1 = makePath(start, end);
      const path2 = makePath({ x: 10, y: 20 }, { x: 110, y: 120 });

      expect(path1).toBe(path2);
    });

    it('should clear cache when clearPathCache is called', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 100 };

      makePath(start, end);
      clearPathCache();

      // Should not throw and should recalculate
      const path = makePath(start, end);
      expect(path).toContain('M0,0');
    });
  });

  describe('createLiveEdge', () => {
    let svgRoot: SVGSVGElement;

    beforeEach(() => {
      svgRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      document.body.appendChild(svgRoot);
    });

    afterEach(() => {
      removeLiveEdge();
      document.body.removeChild(svgRoot);
    });

    it('should create a path element in the SVG', () => {
      createLiveEdge(svgRoot, { x: 0, y: 0 });

      const paths = svgRoot.querySelectorAll('path');
      expect(paths.length).toBe(1);
    });

    it('should set correct stroke attributes', () => {
      createLiveEdge(svgRoot, { x: 0, y: 0 });

      const path = svgRoot.querySelector('path');
      expect(path?.getAttribute('stroke')).toBe('orange');
      expect(path?.getAttribute('stroke-width')).toBe('2');
      expect(path?.getAttribute('fill')).toBe('none');
      expect(path?.getAttribute('stroke-dasharray')).toBe('6 3');
    });

    it('should remove existing live edge before creating new one', () => {
      createLiveEdge(svgRoot, { x: 0, y: 0 });
      createLiveEdge(svgRoot, { x: 50, y: 50 });

      const paths = svgRoot.querySelectorAll('path');
      expect(paths.length).toBe(1);
    });
  });

  describe('updateLiveEdge', () => {
    let svgRoot: SVGSVGElement;

    beforeEach(() => {
      svgRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      document.body.appendChild(svgRoot);
    });

    afterEach(() => {
      removeLiveEdge();
      document.body.removeChild(svgRoot);
    });

    it('should update the path d attribute', () => {
      createLiveEdge(svgRoot, { x: 0, y: 0 });
      updateLiveEdge({ x: 0, y: 0 }, { x: 100, y: 100 });

      const path = svgRoot.querySelector('path');
      const d = path?.getAttribute('d');
      expect(d).toContain('M0,0');
      expect(d).toContain('100,100');
    });

    it('should do nothing if no live edge exists', () => {
      // Should not throw
      expect(() => {
        updateLiveEdge({ x: 0, y: 0 }, { x: 100, y: 100 });
      }).not.toThrow();
    });
  });

  describe('removeLiveEdge', () => {
    let svgRoot: SVGSVGElement;

    beforeEach(() => {
      svgRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      document.body.appendChild(svgRoot);
    });

    afterEach(() => {
      if (svgRoot.parentNode) {
        document.body.removeChild(svgRoot);
      }
    });

    it('should remove the live edge path', () => {
      createLiveEdge(svgRoot, { x: 0, y: 0 });
      removeLiveEdge();

      const paths = svgRoot.querySelectorAll('path');
      expect(paths.length).toBe(0);
    });

    it('should do nothing if no live edge exists', () => {
      // Should not throw
      expect(() => {
        removeLiveEdge();
      }).not.toThrow();
    });

    it('should allow creating new edge after removal', () => {
      createLiveEdge(svgRoot, { x: 0, y: 0 });
      removeLiveEdge();
      createLiveEdge(svgRoot, { x: 50, y: 50 });

      const paths = svgRoot.querySelectorAll('path');
      expect(paths.length).toBe(1);
    });
  });
});
