import { DrawManagerMode } from "../../enums/DrawManagerMode";
import { Shapes } from "../../enums/Shapes";
import { DrawShape } from "../DrawShape";
import { DrawLineShape } from "./DrawLineShape";
import L from "leaflet";

/**
 * A class for drawing polygons on a map.
 */
class DrawPolygon extends DrawLineShape<L.Polygon> {
  private static instance: DrawPolygon | null = null;
  private dragMarker: L.Marker | null;
  private isDraggingCenterMarker: boolean;

  /**
   * Creates a new instance of DrawPolygon.
   * @param map The map on which to draw polygons.
   * @param featureGroup The feature group to which the drawn polygons should be added.
   * @param shapeOptions The options for the polygon shape.
   */
  private constructor(
    map: L.Map,
    featureGroup: L.FeatureGroup,
    shapeOptions: L.PolylineOptions
  ) {
    super(map, featureGroup, shapeOptions, Shapes.POLYGON);
    this.dragMarker = null;
    this.isDraggingCenterMarker = false;
  }

  /**
   * Gets the singleton instance of DrawPolygon, creating it if it does not already exist.
   * @param map The map on which to draw polygons.
   * @param featureGroup The feature group to which the drawn polygons should be added.
   * @param shapeOptions The options for the polygon shape.
   */
  static getInstance(
    map: L.Map,
    featureGroup: L.FeatureGroup,
    shapeOptions: L.PolylineOptions
  ): DrawPolygon {
    DrawShape.validateInstanceCall();
    if (!DrawPolygon.instance) {
      DrawPolygon.instance = new DrawPolygon(map, featureGroup, shapeOptions);
    }

    return DrawPolygon.instance;
  }

  /**
   * Resets the singleton instance of DrawPolygon.
   * Stops drawing the polygon if it is currently drawing.
   */
  resetInstance() {
    if (!DrawPolygon.instance) return;
    DrawPolygon.instance = null;
  }

  /**
   * Stops drawing polygons and resets the singleton instance of DrawPolygon.
   */
  override stopDrawing(): void {
    super.stopDrawing();
    this.removeDragMarker();
    DrawPolygon.instance = null;
  }

  /**
   * Draws a polygon on the map.
   * @param latLngs The coordinates of the polygon's vertices.
   * @returns The polygon that was drawn.
   */
  override drawShape(latLngs: L.LatLng[] | null = null) {
    const polygon = L.polygon(latLngs || this.latLngs, this.shapeOptions);
    this.featureGroup.addLayer(polygon);

    return polygon;
  }

  private addDragMarker() {
    if (!this.currentShape || this.latLngs.length < 3 || this.dragMarker) return;
    // Get the bounds of the polygon
    var polygonBounds = this.currentShape.getBounds();

    // Get the center of the polygon
    var polygonCenter = polygonBounds.getCenter();
    if (!polygonCenter) return;

    const MarkerOptions = {
      draggable: true,
      icon: L.divIcon({
        className: "vertex-marker",
        html: ` `,
        iconSize: L.point(30, 30),
      }),
    };

    var marker = L.marker(polygonCenter, MarkerOptions).addTo(this.featureGroup);
    marker.on(
      "dragstart",
      function (event) {
        this.isDraggingCenterMarker = true;
        this.vertices.clearAllVertices();
        this.disableDrawEvents();
        this.removeDashedPolyline();
      }.bind(this)
    );

    // When the marker is dragged, update the polygon's position
    marker.on("drag", (event) => {
      var markerLatLng = event.target.getLatLng();
      var latlngs = [...this.latLngs];

      // Calculate the offset between the marker's new position and the original polygon center
      var offsetLat = markerLatLng.lat - polygonCenter.lat;
      var offsetLng = markerLatLng.lng - polygonCenter.lng;

      // Update each vertex of the polygon
      for (var i = 0; i < latlngs.length; i++) {
        latlngs[i].lat += offsetLat;
        latlngs[i].lng += offsetLng;
      }

      // Set the new polygon position
      this.latLngs = latlngs;

      this.redrawShape();

      // Update the polygon center
      polygonCenter = markerLatLng;
    });

    marker.on(
      "dragend",
      function (event) {
        this.isDraggingCenterMarker = false;
        this.vertices.setLatLngs = [...this.latLngs];
        this.vertices.drawVertices();
        this.vertices.drawMidpointVertices();
        if (this.drawMode !== DrawManagerMode.DRAW) return;
        this.cursorPosition = event.target._latlng;
        this.drawDashedPolyline();
        setTimeout(() => {
          this.initDrawEvents();
          this.vertices.initDrawEvents();
        }, 50);
      }.bind(this)
    );

    this.dragMarker = marker;
  }

  /**
   * Edits the given shape, adding the necessary event listeners and updating the internal state.
   * @param shape The shape to edit.
   */
  override editShape(shape: L.Polygon<any>) {
    super.editShape(shape);
    this.addDragMarker();

    return this.currentShape;
  }

  override redrawShape(): L.Polygon<any> {
    super.redrawShape();
    if (!this.isDraggingCenterMarker) {
      this.removeDragMarker();
      this.addDragMarker();
    }

    return this.currentShape;
  }

  /**
   * Removes the drag marker from the map if it exists.
   */
  removeDragMarker() {
    if (this.dragMarker) {
      this.featureGroup.removeLayer(this.dragMarker);
      this.dragMarker = null;
    }
  }

  override initDrawEvents(): void {
    super.initDrawEvents();
    this.map.on(
      "click",
      function (e) {
        if (!this.dragMarker) {
          this.addDragMarker();
        }
      }.bind(this)
    );

    this.map.on(
      "contextmenu",
      function (e) {
        if (this.latLngs.length < 3) {
          this.removeDragMarker();
        }
      }.bind(this)
    );
  }
}
export { DrawPolygon };
