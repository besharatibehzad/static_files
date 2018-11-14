function getGeometryTypeFarsiCaption(geometryType) {
    switch (geometryType) {
        case "Point":
            return "نقطه";
        case "LineString":
            return "خط";
        case "Polygon":
            return "چند ضلعی";

        default:
            return "";
    }
}

function activateDrawingTool(geometryType) {
    var drawInteraction = new ol.interaction.Draw({ source: vectorSource, type: geometryType });

    drawInteraction.on('drawend',
        function (e) {
            var currentFeature = e.feature;
            var restOfFeatures = vectorSource.getFeatures();
            var allFeatures = restOfFeatures.concat(currentFeature);
            map.removeInteraction(drawInteraction);
            activateSelectTool();

            onAfterDrawOfModifyOrSelect(currentFeature);
        });

    map.addInteraction(drawInteraction);
}
function activateSelectToolNoFeature() {


    var selectInteraction = new ol.interaction.Select({
        wrapX: false,
        condition: ol.events.condition.click,
        layers: function (layer) {
            return true;
        },
        filter: function (feature, layer) {
            return true;
        }
    });

    map.addInteraction(selectInteraction);

    var selectedFeatures = selectInteraction.getFeatures();

    selectedFeatures.on('add',
        function (event) {
            var feature = event.target.item(0);
            var event = new CustomEvent('select-feature', { detail: feature });
            parent.document.dispatchEvent(event);
        });

}
function activateSelectTool(feature) {


    var selectInteraction = new ol.interaction.Select({
        wrapX: false,
        condition: ol.events.condition.click,
        layers: function (layer) {
            return true;
        },
        filter: function (feature, layer) {
            return !feature.getProperties().Id || (window['isFeatureInEditModeWithId'] && isFeatureInEditModeWithId(feature.getProperties().Id));
        }
    });

    map.addInteraction(selectInteraction);

    var selectedFeatures = selectInteraction.getFeatures();

    selectedFeatures.on('add',
        function (event) {
            var feature = event.target.item(0);
            onAfterDrawOfModifyOrSelect(feature);
        });

    var config = {};

    config.features = selectInteraction.getFeatures();

    var modifyInteraction = new ol.interaction.Modify(config);
    modifyInteraction.on('modifyend',
        function (e) {
            var features = e.features.getArray();
            for (var i = 0; i < features.length; i++) {
                var rev = features[i].getRevision();
                if (rev > 1) {
                    onAfterDrawOfModifyOrSelect(features[i]);
                }
            }
        });

    map.addInteraction(modifyInteraction);
    if (feature)
        window.setTimeout(function () {
            selectInteraction.getFeatures().push(feature);
        });
}

function onAfterDrawOfModifyOrSelect(feature) {
    if (feature)
        activeFeature = feature;

    if (!activeFeature) {
        alert('هیچ عارضه ای بر روی نقشه انتخاب نشده است');
        return;
    }

    if (activeFeature.getGeometry().getType() !== geometryTypeNameForCreate && actionName === "Create")
        return;


    var titleTypedByUser = document.querySelector('.title').value;
    if (titleTypedByUser && titleTypedByUser.trim() !== "")
        activeFeature.setProperties({ Title: titleTypedByUser });
    else if (!activeFeature.getProperties().Title) {
        activeFeature.setProperties({ Title: "" });
    }
    var geometryType = activeFeature.getGeometry().getType();

    if (geometryType.startsWith("Multi")) {
        (function () {
            var multiGeom = activeFeature;

            if (window.savedFeatureToMerge) {
                multiGeom['append' + geometryTypeNameForCreate](window.savedFeatureToMerge.getGeometry());
            }
            

            var clonedActiveFeature = activeFeature.clone();

            var clonedActiveFeatureGeography = clonedActiveFeature.getGeometry().transform('EPSG:3857', 'EPSG:4326');

            clonedActiveFeature.setGeometry(clonedActiveFeatureGeography);

            var toGeoJson = geoJSONFormat.writeFeature(clonedActiveFeature);
            document.querySelector('.to-geo-json').value = toGeoJson;

           
        })();
    } else {
        (function () {
            var multiGeom = new ol.geom['Multi' + geometryTypeNameForCreate]([]);

            if (window.savedFeatureToMerge) {
                multiGeom['append' + geometryTypeNameForCreate](window.savedFeatureToMerge.getGeometry());
            }

            multiGeom['append' + geometryTypeNameForCreate](activeFeature.getGeometry());

            var clonedActiveFeature = activeFeature.clone();
            var clonedMultiGeom = multiGeom.clone();
            var multiGeography = clonedMultiGeom.transform('EPSG:3857', 'EPSG:4326');

            clonedActiveFeature.setGeometry(multiGeography);

            var toGeoJson = geoJSONFormat.writeFeature(clonedActiveFeature);
            document.querySelector('.to-geo-json').value = toGeoJson;
        })();
    }
   

}

function moveToExtent(minLon, maxLat, maxLon, minLat) {
    var topLeft = [minLon, maxLat];
    var bottomRight = [maxLon, minLat];

    var extent = ol.extent.boundingExtent([topLeft, bottomRight]);
    extent = ol.proj.transformExtent(extent, ol.proj.get('EPSG:4326'), ol.proj.get('EPSG:3857'));
    map.getView().fit(extent, { size: map.getSize(), maxZoom: 16 });
}

var activeFeature;
var geoJSONFormat = new ol.format.GeoJSON();
var url = 'GetFeatures.aspx?';
var vectorSource = new ol.source.Vector({
    strategy: ol.loadingstrategy.bbox,
    loader: function (extent, resolution, projection) {

        var from = ol.proj.transform([extent[0], extent[1]], 'EPSG:3857', 'EPSG:4326');
        var to = ol.proj.transform([extent[2], extent[3]], 'EPSG:3857', 'EPSG:4326');

        var u = url + "minLon=" + from[0] + "&maxLon=" + to[0] + "&minLat=" + from[1] + "&maxLat=" + to[1];

        var href = 'exportShapeFile.aspx?spatial=true&' + "minLon=" + from[0] + "&maxLon=" + to[0] + "&minLat=" + from[1] + "&maxLat=" + to[1];

       
        var filterByIds = document.querySelector('.filter-by-ids').value;
        if (filterByIds) {
            u += "&ids=" + filterByIds;
            href += "&ids=" + filterByIds;
        }
        href += "&result=" + "error.html";
       

        document.querySelector('.export-shp').setAttribute('href', href);


        $.ajax(u).then(function (response) {
            var features = geoJSONFormat.readFeatures(response,
                { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });

            var restOfFeatures = vectorSource.getFeatures();

            var newFeatures = features.filter(function (arrivedFeature) {
                var existFeatures = restOfFeatures.filter(function (existFeature) {
                    return existFeature.getProperties().Id === arrivedFeature.getProperties().Id;
                });
                return existFeatures.length === 0;
            });


            vectorSource.addFeatures(newFeatures);

            newFeatures.forEach(function (addedFeature) {
                if (window['featureAdded']) {
                    window.featureAdded(addedFeature);
                }
            });

        });
    },
    wrapX: false,
    format: new ol.format.GeoJSON()
});

var lon = parseFloat(document.querySelector('.loc-lon').value);
var lat = parseFloat(document.querySelector('.loc-lat').value);


// a default style is good practice!
var defaultStyle = new ol.style.Style({
    fill: new ol.style.Fill({
        color: [250, 250, 250, 1]
    }),
    stroke: new ol.style.Stroke({
        color: [200, 0, 0, 1],
        width: 3
    })
});

// a javascript object literal can be used to cache
// previously created styles. Its very important for
// performance to cache styles.
var styleCache = {};

// the style function returns an array of styles
// for the given feature and resolution.
// Return null to hide the feature.
function styleFunction(feature, resolution) {
    // get the incomeLevel from the feature properties
    var externalData = feature.get('ExternalData');
    // if there is no level or its one we don't recognize,
    // return the default style (in an array!)
    if (!externalData || externalData.trim() === '') {
        return [defaultStyle];
    }
    // آسفالت
    // check the cache and create a new style for the income
    // level if its not been created before.
    if (externalData.startsWith('1,')) {
        if (!styleCache[externalData]) {
            styleCache[externalData] = new ol.style.Style({
                fill: new ol.style.Fill({
                    color: [250, 250, 0, 1]
                }),
                stroke: new ol.style.Stroke({
                    color: [0, 0, 100, 1],
                    width: 3
                })
            });
        }

        // at this point, the style for the current level is in the cache
        // so return it (as an array!)
        return [styleCache[externalData]];
    }
    // خاکی
    if (externalData.startsWith('2,')) {
        if (!styleCache[externalData]) {
            styleCache[externalData] = new ol.style.Style({
                fill: new ol.style.Fill({
                    color: [250, 250, 0, 1]
                }),
                stroke: new ol.style.Stroke({
                    color: [0, 200, 50, 1],
                    width: 3,
                    lineDash: [.1, 5] //or other combinations
                }),
                zIndex: 2
            });
        }

        // at this point, the style for the current level is in the cache
        // so return it (as an array!)
        return [styleCache[externalData]];
    }
    // احداث نشده
    if (externalData.startsWith('3,')) {
        if (!styleCache[externalData]) {
            styleCache[externalData] = new ol.style.Style({
                fill: new ol.style.Fill({
                    color: [250, 250, 0, 1]
                }),
                stroke: new ol.style.Stroke({
                    color: [200, 0, 0, 1],
                    width: 3
                })
            });
        }

        // at this point, the style for the current level is in the cache
        // so return it (as an array!)
        return [styleCache[externalData]];
    }

    return [defaultStyle];
}

var baseMaps = [
    {
        id: 1,
        title: 'Open Street Map',
        source: new ol.source.OSM()
    },
    {
        id: 2,
        title: 'Google Map',
        source: new ol.source.XYZ({
            url: 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}'
        })
    },
    {
        id: 3,
        title: 'Google Satellite',
        source: new ol.source.XYZ({
            url: 'http://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}'
        })
    },
    {
        id: 4,
        title: 'Google Satellite Hybrid',
        source: new ol.source.XYZ({
            url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        })
    },
    {
        id: 5,
        title: 'Google Train',
        source: new ol.source.XYZ({
            url: 'https://mt1.google.com/vt/lyrs=t&x={x}&y={y}&z={z}'
        })
    },
    {
        id: 6,
        title: 'Google Roads',
        source: new ol.source.XYZ({
            url: 'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}'
        })
    }
]
var tileLayer = new ol.layer.Tile({
    source: baseMaps.filter(function (it) { return it.id === 1 })[0].source
});

var map = new ol.Map({
    layers: [
        tileLayer,
        new ol.layer.Vector({
            source: vectorSource,
            style: styleFunction
        })
    ],
    renderer: 'canvas',
    target: 'map',
    view: new ol.View({
        center: ol.proj.fromLonLat([lon, lat]),
        zoom: 14
    })
});



var mapCanvase;

map.once('postcompose', function (event) {
    mapCanvase = event.context.canvas;
    map.renderSync();
});

if (actionName === "Select") {
    document.querySelector('.save-btn').style.display = 'none';
    document.querySelector('.export-png').style.right = '8px';
}

map.on('pointermove', function (evt) {
    // When user was dragging map, then coordinates didn't change and there's
    // no need to continue
    if (evt.dragging) {
        return;
    }

    var lonLat = ol.proj.toLonLat(evt.coordinate);
    var utm = fromLatLon(lonLat[1], lonLat[0]);

    document.querySelector('.map-mouse-position').innerHTML = 'easting:' + utm.easting + ' northing:' + utm.northing + ' zone:' + utm.zoneNum + utm.zoneLetter + ' lon:' + lonLat[0] + ' lat:' + lonLat[1];

});

document.querySelector('.export-png').addEventListener('click', function () {
    /*if (navigator.msSaveBlob) {
        navigator.msSaveBlob(mapCanvase.msToBlob(), 'map.png');
    } else {
        mapCanvase.toBlob(function (blob) {
            saveAs(blob, 'map.png');
        });
    }

    map.renderSync();*/

    window.print();
});


var baseMapSelector = document.querySelector('.select-basemap');

baseMaps.forEach(function (item) {
    var opt = document.createElement("option");
    opt.value = item.id;
    opt.innerHTML = item.title;

    // then append it to the select element
    baseMapSelector.appendChild(opt);
});

baseMapSelector.addEventListener('change', function (e) {
    var value = parseInt(baseMapSelector.options[baseMapSelector.selectedIndex].value);
    tileLayer.setSource(baseMaps.filter(function (it) { return it.id === value })[0].source);
    tileLayer.changed();
});


function gotoAddress(address) {
    
    var url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + address + '&key=AIzaSyB-ft88vyrL7VweXBMmKRFZQhJ33DSqM0M'

    $.ajax(url).then(function (response) {
        try {

            const coords = fromLonLat([response.results[0].geometry.location.lng, response.results[0].geometry.location.lat]);
            map.getView().animate({ center: coords, zoom: 14 });
         
            
        } catch{
            alert('آدرس یافت نشد.');
        }
        
    });
}

if (parent) {
    parent.window.gotoAddress = gotoAddress;
}
