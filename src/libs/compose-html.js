const composeHtml = (style, mapControlVersion = 2) => {
  const styleSet = {
    "version":"2021-02-01",
    "defaultStyle":"custom",
    "styles":[{
      "name":"custom",
      "theme":"light",
      "thumbnail":"{{azMapsStylingPath}}/{{azMapsStylePath}}/road/thumbnail.png",
      "copyright":["©2021 TomTom"]
    }, {
      "name":"custom_indoor",
      "theme":"light",
      "thumbnail":"{{azMapsStylingPath}}/{{azMapsStylePath}}/road/thumbnail.png",
      "copyright":["©2021 TomTom"]
    }]
  };

  const tilesetId = style.metadata ? style.metadata["maputnik:azuremaps_tileset_id"] : undefined;
  const bbox = style.metadata ? style.metadata["maputnik:azuremaps_tileset_bbox"] : undefined;
  const targetStyle = {...style, metadata: { ...style.metadata || {} }};
  delete targetStyle.metadata["maputnik:azuremaps_subscription_key"];

  const fitBoundsJavascript = !bbox ? `` : `
    map._getMap().fitBounds([[${bbox[0]}, ${bbox[1]}],[${bbox[2]}, ${bbox[3]}]], {
      zoom: 19
    })
  `
  const indoorJavascript = !tilesetId ? `` : `
    const indoorManager = new atlas.indoor.IndoorManager(map, {
      tilesetId: '${tilesetId}'
    });

    ${fitBoundsJavascript}
  `

  const sanitize = json => json
    .replace(/[\\]/g, '\\\\')
    .replace(/[\']/g, '\\\'')
    .replace(/[\"]/g, '\\\"')
    .replace(/[\/]/g, '\\/')
    .replace(/[\b]/g, '\\b')
    .replace(/[\f]/g, '\\f')
    .replace(/[\n]/g, '\\n')
    .replace(/[\r]/g, '\\r')
    .replace(/[\t]/g, '\\t');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <title>Map</title>
    <meta charset="utf-8" />
    <link rel="shortcut icon" href="/favicon.ico"/>
    <meta http-equiv="x-ua-compatible" content="IE=Edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <meta name="description" content="This sample shows a map with your customized style" />
    <meta name="keywords" content="Microsoft Hackathon, Microsoft maps, map, gis, API, SDK, map style" />
    <meta name="author" content="Your hard work & Microsoft Azure Maps Maputnik" />

    <link rel="stylesheet" href="https://atlas.microsoft.com/sdk/javascript/mapcontrol/${mapControlVersion}/atlas.min.css" type="text/css" />
    <script src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/${mapControlVersion}/atlas.min.js"></script>
    <link rel="stylesheet" href="https://atlas.microsoft.com/sdk/javascript/indoor/0.1/atlas-indoor.min.css" type="text/css" />
    <script src="https://atlas.microsoft.com/sdk/javascript/indoor/0.1/atlas-indoor.min.js"></script>

    <script type='text/javascript'>
        const jsonToUrl = json => URL.createObjectURL(new Blob([json], {type: "application/json"}));
        const styleJson = '${sanitize(JSON.stringify(targetStyle))}';
        const styleSetJson = '${sanitize(JSON.stringify(styleSet))}';

        const styleURL = jsonToUrl(styleJson);
        const styleSetURL = jsonToUrl(styleSetJson);

        function GetMap() {
            //Initialize a map instance.
            const map = new atlas.Map('map-control', {
                center: [-122.33, 47.6],
                zoom: 12,
                view: 'Auto',

                //Add authentication details for connecting to Azure Maps.
                authOptions: {
                    authType: 'subscriptionKey',
                    subscriptionKey: '${style.metadata["maputnik:azuremaps_subscription_key"]}'
                },

                transformRequest: (url, resourceType) => {
                  if(resourceType === "StyleDefinitions"){
                    return { url: styleSetURL }
                  } else if(resourceType === "Style"){
                    return { url: styleURL }
                  }
                  return { url }
                }
            });

            //Wait until the map resources are ready.
            map.events.add('ready', function () {
              ${indoorJavascript}
            });
        }
    </script>
</head>
<body onload="GetMap()" style="margin: 0"><div id="map-control" style="width:100vw;height:100vh;"></div></body>
</html>
`
}

export default composeHtml;
