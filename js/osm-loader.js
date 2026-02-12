// ============================================================
// OSM LOADER — Overpass API client + data processing
// ============================================================
class OSMLoader {

  // Overpass API endpoints to try (multiple mirrors for reliability)
  static OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
  ];

  // Fetch all drivable roads in a radius around lat/lng
  async fetchRoads(lat, lng, radiusMeters) {
    const latOffset = radiusMeters / 111320;
    const lngOffset = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
    const south = lat - latOffset, north = lat + latOffset;
    const west = lng - lngOffset, east = lng + lngOffset;

    const query = `
      [out:json][timeout:60];
      way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]
        (${south},${west},${north},${east});
      out body geom;
    `;

    const body = 'data=' + encodeURIComponent(query);
    let lastError = null;

    // Try each endpoint, with one retry each
    for (const endpoint of OSMLoader.OVERPASS_ENDPOINTS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`Trying ${endpoint} (attempt ${attempt + 1})...`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000);

          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (resp.status === 429 || resp.status === 504 || resp.status === 503) {
            lastError = new Error(`${endpoint}: HTTP ${resp.status}`);
            console.warn(lastError.message);
            // Wait a moment before retry/next server
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          if (!resp.ok) {
            lastError = new Error(`${endpoint}: HTTP ${resp.status}`);
            console.warn(lastError.message);
            break; // skip retries for other errors, try next endpoint
          }

          const data = await resp.json();

          const ways = [];
          for (const el of data.elements) {
            if (el.type !== 'way' || !el.geometry) continue;
            ways.push({
              id: el.id,
              nodes: el.geometry,
              tags: el.tags || {},
              highway: (el.tags && el.tags.highway) || 'unclassified'
            });
          }
          console.log(`Loaded ${ways.length} roads from ${endpoint}`);
          return ways;

        } catch (e) {
          lastError = e;
          console.warn(`${endpoint} attempt ${attempt + 1} failed:`, e.message);
          if (e.name === 'AbortError') {
            console.warn('Request timed out');
          }
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    throw new Error('All Overpass servers failed. ' + (lastError ? lastError.message : 'Try again later.'));
  }

  // Fetch OSM raster map tiles covering the area
  async fetchTiles(lat, lng, radiusMeters, centerLat, centerLng, offsetX, offsetY) {
    const z = 15; // zoom level — each tile ~770m at mid latitudes, good balance
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

    // Bounding box in lat/lng
    const latOff = radiusMeters / 111320;
    const lngOff = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
    const south = lat - latOff, north = lat + latOff;
    const west = lng - lngOff, east = lng + lngOff;

    // Convert bbox to tile coordinates
    const txMin = this._lngToTileX(west, z);
    const txMax = this._lngToTileX(east, z);
    const tyMin = this._latToTileY(north, z); // note: north has smaller Y
    const tyMax = this._latToTileY(south, z);

    // Cap tile count to avoid excessive requests
    const tileCount = (txMax - txMin + 1) * (tyMax - tyMin + 1);
    if (tileCount > 250) {
      console.warn(`Too many tiles (${tileCount}), skipping tile background`);
      return [];
    }

    // Fetch all tiles in parallel
    const promises = [];
    for (let ty = tyMin; ty <= tyMax; ty++) {
      for (let tx = txMin; tx <= txMax; tx++) {
        promises.push(this._loadTile(tx, ty, z, centerLat, centerLng, metersPerDegreeLat, metersPerDegreeLng, offsetX, offsetY));
      }
    }

    const results = await Promise.all(promises);
    return results.filter(t => t !== null);
  }

  _loadTile(tx, ty, z, centerLat, centerLng, mPerDegLat, mPerDegLng, offsetX, offsetY) {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Convert tile bounds to game coordinates
        const tileLngLeft = this._tileXToLng(tx, z);
        const tileLngRight = this._tileXToLng(tx + 1, z);
        const tileLatTop = this._tileYToLat(ty, z);
        const tileLatBottom = this._tileYToLat(ty + 1, z);

        const gameX = (tileLngLeft - centerLng) * mPerDegLng * PIXELS_PER_METER + offsetX;
        const gameY = -(tileLatTop - centerLat) * mPerDegLat * PIXELS_PER_METER + offsetY;
        const gameRight = (tileLngRight - centerLng) * mPerDegLng * PIXELS_PER_METER + offsetX;
        const gameBottom = -(tileLatBottom - centerLat) * mPerDegLat * PIXELS_PER_METER + offsetY;

        resolve({ img, gameX, gameY, gameW: gameRight - gameX, gameH: gameBottom - gameY });
      };
      img.onerror = () => resolve(null); // skip failed tiles
      img.src = `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
    });
  }

  // Slippy map tile math helpers
  _lngToTileX(lng, z) {
    return Math.floor((lng + 180) / 360 * Math.pow(2, z));
  }

  _latToTileY(lat, z) {
    const latRad = lat * Math.PI / 180;
    return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z));
  }

  _tileXToLng(x, z) {
    return x / Math.pow(2, z) * 360 - 180;
  }

  _tileYToLat(y, z) {
    const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  // Convert ways to game-coordinate road segments
  buildRoadSegments(ways, centerLat, centerLng) {
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

    const segments = [];
    for (const way of ways) {
      const points = [];
      for (const node of way.nodes) {
        const x = (node.lon - centerLng) * metersPerDegreeLng * PIXELS_PER_METER;
        const y = -(node.lat - centerLat) * metersPerDegreeLat * PIXELS_PER_METER;
        points.push({ x, y });
      }
      if (points.length < 2) continue;

      // Simplify
      const simplified = this.simplify(points, SIMPLIFICATION_TOLERANCE * metersPerDegreeLat * PIXELS_PER_METER);
      if (simplified.length < 2) continue;

      // Road width from highway type
      const width = ROAD_WIDTHS[way.highway] || DEFAULT_ROAD_WIDTH;

      // Lanes override
      if (way.tags.lanes) {
        const lanes = parseInt(way.tags.lanes);
        if (lanes > 0) {
          const laneWidth = width / 2; // base per-lane
          // don't override if it would make narrower
        }
      }

      segments.push({
        points: simplified,
        width: width,
        type: way.highway,
        oneway: way.tags.oneway === 'yes',
        name: way.tags.name || ''
      });
    }

    // Center the whole network around a reasonable world origin
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const seg of segments) {
      for (const p of seg.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const offsetX = 1300 - cx, offsetY = 1000 - cy;
    for (const seg of segments) {
      for (const p of seg.points) {
        p.x += offsetX;
        p.y += offsetY;
      }
    }

    // Store centering offsets so tiles can use the same transform
    this._lastOffsetX = offsetX;
    this._lastOffsetY = offsetY;

    return segments;
  }

  // Convert a lat/lng to the nearest road point in game coordinates
  latLngToGamePoint(lat, lng, centerLat, centerLng, segments) {
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
    // Convert to raw game coords (before centering offset)
    const rawX = (lng - centerLng) * metersPerDegreeLng * PIXELS_PER_METER + this._lastOffsetX;
    const rawY = -(lat - centerLat) * metersPerDegreeLat * PIXELS_PER_METER + this._lastOffsetY;

    // Find nearest road point to snap to
    let bestDist = Infinity, bestPt = null;
    for (const seg of segments) {
      for (let i = 0; i < seg.points.length - 1; i++) {
        const a = seg.points[i], b = seg.points[i + 1];
        const pt = this._closestOnSeg(rawX, rawY, a, b);
        if (pt.dist < bestDist) {
          bestDist = pt.dist;
          bestPt = { x: pt.x, y: pt.y };
        }
      }
    }
    return bestPt;
  }

  _closestOnSeg(px, py, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const apx = px - a.x, apy = py - a.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq === 0) return { x: a.x, y: a.y, dist: Math.sqrt((px-a.x)**2 + (py-a.y)**2) };
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq));
    const cx = a.x + abx * t, cy = a.y + aby * t;
    return { x: cx, y: cy, dist: Math.sqrt((px-cx)**2 + (py-cy)**2) };
  }

  // Find start and finish as the two most distant road endpoints
  findStartFinish(segments) {
    // Collect all road endpoints
    const endpoints = [];
    for (const seg of segments) {
      endpoints.push(seg.points[0]);
      endpoints.push(seg.points[seg.points.length - 1]);
    }

    // Find the two most distant endpoints
    let bestDist = 0, startPt = null, finishPt = null;
    // Sample to keep it fast — check up to 500 random pairs if too many endpoints
    const pts = endpoints.length > 200
      ? endpoints.filter((_, i) => i % Math.ceil(endpoints.length / 200) === 0)
      : endpoints;

    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
        if (d > bestDist) {
          bestDist = d;
          startPt = pts[i];
          finishPt = pts[j];
        }
      }
    }

    return { start: startPt, finish: finishPt, distance: Math.sqrt(bestDist) };
  }

  // Douglas-Peucker line simplification (operates in pixel space)
  simplify(points, tolerance) {
    if (points.length <= 2) return points;

    let maxDist = 0, maxIdx = 0;
    const first = points[0], last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const d = this._perpendicularDist(points[i], first, last);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }

    if (maxDist > tolerance) {
      const left = this.simplify(points.slice(0, maxIdx + 1), tolerance);
      const right = this.simplify(points.slice(maxIdx), tolerance);
      return left.slice(0, -1).concat(right);
    }
    return [first, last];
  }

  _perpendicularDist(pt, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return dist(pt.x, pt.y, lineStart.x, lineStart.y);
    const t = clamp(((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / lenSq, 0, 1);
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    return dist(pt.x, pt.y, projX, projY);
  }

  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
