/* @requires mapshaper-canvas, mapshaper-gui-shapes, mapshaper-gui-table, mapshaper-dynamic-crs */

// Wrap a layer in an object along with information needed for rendering
function getMapLayer(layer, dataset, opts) {
  var obj = {
    layer: null,
    arcs: null,
    // display_arcs: null,
    style: null,
    source: {
      layer: layer,
      dataset: dataset
    },
    empty: internal.getFeatureCount(layer) === 0
  };

  var sourceCRS = opts.crs && internal.getDatasetCRS(dataset); // get src iff display CRS is given
  var displayCRS = opts.crs || null;
  var arcs = dataset.arcs;

  // Assume that dataset.displayArcs is in the display CRS
  // (it should have been deleted upstream if reprojected is needed)
  if (arcs && !dataset.displayArcs) {
    // project arcs, if needed
    if (needReprojectionForDisplay(sourceCRS, displayCRS)) {
      arcs = projectArcsForDisplay(arcs, sourceCRS, displayCRS);
    }

    // init filtered arcs, if needed
    dataset.displayArcs = new FilteredArcCollection(arcs);
  }

  if (internal.layerHasFurniture(layer)) {
    obj.furniture = true;
    obj.furniture_type = internal.getFurnitureLayerType(layer);
    obj.layer = layer;
    // treating furniture layers (other than frame) as tabular for now,
    // so there is something to show if they are selected
    obj.tabular = obj.furniture_type != 'frame';
  } else if (obj.empty) {
    obj.layer = {shapes: []}; // ideally we should avoid empty layers
  } else if (!layer.geometry_type) {
    obj.tabular = true;
  } else {
    obj.geographic = true;
    obj.layer = layer;
    obj.arcs = arcs; // replaced by filtered arcs during render sequence
  }

  if (obj.tabular) {
    utils.extend(obj, getDisplayLayerForTable(layer.data));
  }

  // dynamic reprojection (arcs were already reprojected above)
  if (obj.geographic && needReprojectionForDisplay(sourceCRS, displayCRS)) {
    obj.dynamic_crs = displayCRS;
    if (internal.layerHasPoints(layer)) {
      obj.layer = projectPointsForDisplay(layer, sourceCRS, displayCRS);
    }
  }

  obj.bounds = getDisplayBounds(obj.layer, obj.arcs);
  return obj;
}


function getDisplayBounds(lyr, arcs) {
  var arcBounds = arcs ? arcs.getBounds() : new Bounds(),
      bounds = arcBounds, // default display extent: all arcs in the dataset
      lyrBounds;

  if (lyr.geometry_type == 'point') {
    lyrBounds = internal.getLayerBounds(lyr);
    if (lyrBounds && lyrBounds.hasBounds()) {
      if (lyrBounds.area() > 0 || !arcBounds.hasBounds()) {
        bounds = lyrBounds;
      } else {
        // if a point layer has no extent (e.g. contains only a single point),
        // then merge with arc bounds, to place the point in context.
        bounds = arcBounds.mergeBounds(lyrBounds);
      }
    }
  }

  if (!bounds || !bounds.hasBounds()) { // empty layer
    bounds = new Bounds();
  }
  return bounds;
}
