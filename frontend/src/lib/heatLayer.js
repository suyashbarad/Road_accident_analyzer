import L from 'leaflet'
import simpleheat from 'simpleheat'

/**
 * A dependency-light heatmap layer for Leaflet, built directly on `simpleheat`.
 * Implemented as an L.Layer with its own canvas so we control z-order via a
 * dedicated pane (heat sits above tiles, below the risk polylines/markers).
 */
export const HeatLayer = L.Layer.extend({
  options: {
    pane: 'heatPane',
    radius: 26,
    blur: 18,
    max: 1.0,
    opacity: 0.9,
    gradient: {
      0.15: 'rgba(47,139,255,0.55)',
      0.35: '#22c55e',
      0.55: '#eab308',
      0.75: '#f97316',
      1.0: '#ef4444',
    },
  },

  initialize(points, options) {
    this._points = points || []
    L.setOptions(this, options)
  },

  onAdd(map) {
    this._map = map
    if (!this._canvas) this._initCanvas()
    const pane = map.getPane(this.options.pane) || map.getPane('overlayPane')
    pane.appendChild(this._canvas)
    map.on('moveend', this._reset, this)
    map.on('resize', this._resize, this)
    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.on('zoomanim', this._animateZoom, this)
    }
    this._reset()
  },

  onRemove(map) {
    const pane = map.getPane(this.options.pane) || map.getPane('overlayPane')
    if (this._canvas && this._canvas.parentNode === pane) pane.removeChild(this._canvas)
    map.off('moveend', this._reset, this)
    map.off('resize', this._resize, this)
    map.off('zoomanim', this._animateZoom, this)
    this._map = null
  },

  setData(points) {
    this._points = points || []
    this._redraw()
    return this
  },

  update(options) {
    L.setOptions(this, options)
    if (this._heat && options.gradient) this._heat.gradient(options.gradient)
    this._redraw()
    return this
  },

  _initCanvas() {
    const canvas = (this._canvas = L.DomUtil.create('canvas', 'leaflet-heat-layer leaflet-layer'))
    const size = this._map ? this._map.getSize() : { x: 800, y: 600 }
    canvas.width = size.x
    canvas.height = size.y
    canvas.style.pointerEvents = 'none'
    if (this._map && this._map.options.zoomAnimation && L.Browser.any3d) {
      L.DomUtil.addClass(canvas, 'leaflet-zoom-animated')
    }
    this._heat = simpleheat(canvas)
    if (this.options.gradient) this._heat.gradient(this.options.gradient)
  },

  _resize(e) {
    if (!this._canvas) return
    this._canvas.width = e.newSize.x
    this._canvas.height = e.newSize.y
    this._redraw()
  },

  _reset() {
    if (!this._canvas || !this._map) return
    const topLeft = this._map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this._canvas, topLeft)
    this._redraw()
  },

  _animateZoom(e) {
    if (!this._canvas || !this._map) return
    try {
      const scale = this._map.getZoomScale(e.zoom)
      const offset = this._map
        ._latLngBoundsToNewLayerBounds(this._map.getBounds(), e.zoom, e.center)
        .min
      L.DomUtil.setTransform(this._canvas, offset, scale)
    } catch {
      /* private API changed - fall back to a redraw after the animation */
      setTimeout(() => this._reset(), 260)
    }
  },

  _redraw() {
    if (!this._heat || !this._map) return
    const data = []
    const bounds = this._map.getBounds().pad(0.2)
    const maxV = this.options.max || 1
    for (let i = 0; i < this._points.length; i++) {
      const p = this._points[i]
      const lat = p[0]
      const lon = p[1]
      if (!bounds.contains([lat, lon])) continue
      const pt = this._map.latLngToContainerPoint([lat, lon])
      const v = p.length > 2 && p[2] != null ? p[2] : 0.5
      data.push([Math.round(pt.x), Math.round(pt.y), Math.min(1, v / maxV)])
    }
    this._heat.data(data).radius(this.options.radius, this.options.blur)
    this._heat.draw()
    if (this._canvas) this._canvas.style.opacity = this.options.opacity ?? 1
  },
})

export function heatLayer(points, options) {
  return new HeatLayer(points, options)
}
