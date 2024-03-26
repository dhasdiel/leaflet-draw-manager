import L, { LeafletMouseEvent, LatLng, PolylineOptions } from "leaflet";
import { DrawManagerMode } from "../../enums/DrawManagerMode";
import { DrawShape } from "../DrawShape";
import { Shapes } from "../../enums/Shapes";
import { IDrawShape } from "../../interfaces/IDrawShape";
import { DrawLineVertices } from "../../Vertices/DrawLineVertices";

class DrawLineShape<T extends L.Polygon | L.Polyline>
  extends DrawShape<T>
  implements IDrawShape<T>
{
  protected shapeOptions: L.PolylineOptions;
  protected vertices: DrawLineVertices;
  protected dashedPolyline: {
    element: L.Polyline | null;
    coordinates: LatLng[];
  };

  constructor(
    map: L.Map,
    featureGroup: L.FeatureGroup,
    shapeOptions: L.PolylineOptions,
    type: Shapes.POLYGON | Shapes.POLYLINE
  ) {
    super(map, featureGroup);
    this.shapeOptions = shapeOptions;
    this.shapeType = type;
    this.vertices = new DrawLineVertices(map, type);
    this.vertices.setShapeType = type;
    this.dashedPolyline = {
      element: null,
      coordinates: null,
    };
  }

  startDrawing(drawVertices = true) {
    this.drawMode = DrawManagerMode.DRAW;
    this.initDrawEvents();

    if (drawVertices) {
      this.vertices.initDrawEvents();
      this.setVerticesEvents();
    }

    if (!this.currentShape) {
      this.currentShape = this.drawShape();
    } else {
      this.redrawShape();
    }
  }

  setVerticesEvents() {
    this.vertices.setHandleDragVertex(this.handleDragVertex.bind(this));
    this.vertices.setHandleDragMidpointVertex(
      this.handleDragMidpointVertex.bind(this)
    );
  }

  cancelEdit() {
    this.latLngs = [...this.preEditLatLngs];
    this.redrawShape();
    if (this.onCancelEditHandler) {
      this.onCancelEditHandler(this.currentShape);
    }
    this.onFinishHandler = null;
    this.stopDrawing();
  }

  override stopDrawing() {
    if (this.drawMode === DrawManagerMode.EDIT && this.currentShape) {
      this.currentShape.setStyle({
        ...this.currentShape.options,
        fillOpacity: 0.2,
        dashArray: undefined,
      });
    }
    super.stopDrawing();
    this.removeDashedPolyline();
    this.vertices.clearAllVertices();
  }

  override deleteShape() {
    super.deleteShape();
    this.redrawShape();
    this.stopDrawing();
  }

  editShape(shape: T) {
    this.drawMode = DrawManagerMode.EDIT;
    this.currentShape = shape;
    this.featureGroup.addLayer(this.currentShape);
    this.latLngs = this.getShapeLatLngs();
    this.preEditLatLngs = [...this.latLngs];

    this.currentShape.setStyle({
      ...this.currentShape.options,
      dashArray: "12,12",
      fillOpacity: 0.3,
    });

    this.redrawShape();
    this.vertices.clearAllVertices();
    this.vertices.setLatLngs = [...this.latLngs];
    this.setVerticesEvents();
    this.vertices.drawVertices();
    this.vertices.drawMidpointVertices();
    this.disableDrawEvents();

    return this.currentShape;
  }

  redrawShape(): T | undefined {
    if (!this.currentShape) return;
    if (!this.featureGroup.hasLayer(this.currentShape)) {
      this.featureGroup.addLayer(this.currentShape);
    }

    this.currentShape.setLatLngs(this.latLngs);

    return this.currentShape;
  }

  handleDragVertex(e: any, index?: number): void {
    if (index || index == 0) this.latLngs[index] = e.latlng;
    this.redrawShape();
  }

  handleDragMidpointVertex(e: any, index: number, insert = true): void {
    if (insert) this.latLngs.splice(index + 1, 0, e.latlng);
    else this.latLngs[index + 1] = e.latlng;

    this.redrawShape();
  }

  getShapeLatLngs(): LatLng[] {
    if (!this.currentShape) return [];
    const shapeLatLngs = this.currentShape.getLatLngs();

    return (
      this.currentShape instanceof L.Polygon ? shapeLatLngs[0] : shapeLatLngs
    ) as LatLng[];
  }

  drawShape(): T {
    throw new Error("drawShape method must be implemented in the derived class.");
  }

  setLatLngs(latLngs: LatLng[]): void {
    this.latLngs = latLngs;
    this.vertices.clearAllVertices();
    this.vertices.setLatLngs = [...latLngs];
    this.vertices.drawVertices();
    this.vertices.drawMidpointVertices();
    this.redrawShape();
  }

  displayLineDistances(display: boolean) {
    this.vertices.displayLineDistances(display);
  }

  getDisplayLineDistances() {
    return this.vertices.getDisplayLineDistances();
  }

  setCustomOnDragEndHandler(handler: (latLngs: LatLng[]) => void) {
    this.vertices.handleOnDragEnd = () => handler(this.latLngs);
  }

  override setShapeOptions(options: L.PolylineOptions): void {
    super.setShapeOptions(options);
    this.currentShape?.setStyle(options);
  }

  initDrawEvents(): void {
    this.map.on("click", this.handleMapClick.bind(this));
    this.map.on("contextmenu", this.handleContextClick.bind(this));
    if (!this.isTouchDevice)
      this.map.on("mousemove", this.handleMouseMove.bind(this));
  }

  handleMapClick(e: LeafletMouseEvent) {
    this.latLngs.push(e.latlng);
    this.redrawShape();

    if (this.onClickHandler) {
      this.onClickHandler(this.latLngs);
    }
  }

  handleContextClick() {
    this.latLngs.pop();
    this.redrawShape();

    if (this.latLngs.length === 0) {
      this.stopDrawing();
    }

    if (this.onClickHandler) {
      this.onClickHandler(this.latLngs);
    }
    this.vertices.handleContextClick();
  }

  handleMouseMove(e) {
    if (this.drawMode !== DrawManagerMode.DRAW) return;
    this.cursorPosition = e.latlng;
    this.drawDashedPolyline();
  }

  removeDashedPolyline() {
    if (!this.dashedPolyline.element) return;
    this.featureGroup.removeLayer(this.dashedPolyline.element);
    this.dashedPolyline.element = null;
  }

  drawDashedPolyline() {
    if (!this.latLngs.length) return;

    this.removeDashedPolyline();
    this.dashedPolyline.coordinates = [this.latLngs.at(-1), this.cursorPosition];
    this.dashedPolyline.element = L.polyline(this.dashedPolyline.coordinates, {
      ...this.shapeOptions,
      className: "cursor-crosshair",
      weight: 4,
      lineCap: "square", // Optional, just to avoid round borders.
      dashArray: "3, 25",
      dashOffset: "10",
    });
    this.featureGroup.addLayer(this.dashedPolyline.element);
  }

  /**
   * Sets the value of a shape attribute.
   * @param attribute The name of the shape attribute to change.
   * @param value The new value of the shape attribute.
   */
  changeShapeAttribute(attribute: keyof PolylineOptions, value: any) {
    if (!this.currentShape) return;
    this.currentShape.setStyle({
      ...this.currentShape.options,
      [attribute]: value,
    });

    // if (attribute == "weight") {
    //   this.currentShadowEntity?.setStyle({
    //     ...this.currentShadowEntity.options,
    //     [attribute]: value + 3,
    //   });
    //   return;
    // }

    // this.currentShadowEntity?.setStyle({
    //   ...this.currentShadowEntity.options,
    //   [attribute]: value,
    // });
  }
}

export { DrawLineShape };
