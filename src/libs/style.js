import deref from '@mapbox/mapbox-gl-style-spec/deref'
import tokens from '../config/tokens.json'
import cloneDeep from 'lodash.clonedeep'

// Empty style is always used if no style could be restored or fetched
const emptyStyle = ensureStyleValidity({
  version: 8,
  sources: {},
  layers: [],
})

function generateId() {
  return Math.random().toString(36).substr(2, 9)
}

function ensureHasId(style) {
  if('id' in style) return style
  style.id = generateId()
  return style
}

function ensureHasNoInteractive(style) {
  const changedLayers = style.layers.map(layer => {
    const changedLayer = { ...layer }
    delete changedLayer.interactive
    return changedLayer
  })

  const nonInteractiveStyle = {
    ...style,
    layers: changedLayers
  }
  return nonInteractiveStyle
}

function ensureHasNoRefs(style) {
  const derefedStyle = {
    ...style,
    layers: deref(style.layers)
  }
  return derefedStyle
}

function ensureStyleValidity(style) {
  return ensureHasNoInteractive(ensureHasNoRefs(ensureHasId(style)))
}

function indexOfLayer(layers, layerId) {
  for (let i = 0; i < layers.length; i++) {
    if(layers[i].id === layerId) {
      return i
    }
  }
  return null
}

function getAccessToken(sourceName, mapStyle, opts) {
  if(sourceName === "thunderforest_transport" || sourceName === "thunderforest_outdoors") {
    sourceName = "thunderforest"
  }

  const metadata = mapStyle.metadata || {}
  let accessToken = metadata[`maputnik:${sourceName}_access_token`]

  if(opts.allowFallback && !accessToken) {
    accessToken = tokens[sourceName]
  }

  return accessToken;
}

function replaceSourceAccessToken(mapStyle, sourceName, opts={}) {
  const source = mapStyle.sources[sourceName]
  if(!source) return mapStyle
  if(!source.hasOwnProperty("url")) return mapStyle

  const accessToken = getAccessToken(sourceName, mapStyle, opts)

  if(!accessToken) {
    // Early exit.
    return mapStyle;
  }

  const changedSources = {
    ...mapStyle.sources,
    [sourceName]: {
      ...source,
      url: source.url.replace('{key}', accessToken)
    }
  }
  const changedStyle = {
    ...mapStyle,
    sources: changedSources
  }
  return changedStyle
}

function replaceAccessTokens(mapStyle, opts={}) {
  let changedStyle = mapStyle

  Object.keys(mapStyle.sources).forEach((sourceName) => {
    changedStyle = replaceSourceAccessToken(changedStyle, sourceName, opts);
  })

  if (mapStyle.glyphs && (mapStyle.glyphs.match(/\.tilehosting\.com/) || mapStyle.glyphs.match(/\.maptiler\.com/))) {
    const newAccessToken = getAccessToken("openmaptiles", mapStyle, opts);
    if (newAccessToken) {
      changedStyle = {
        ...changedStyle,
        glyphs: mapStyle.glyphs.replace('{key}', newAccessToken)
      }
    }
  }

  return changedStyle
}

function stripAccessTokens(mapStyle) {
  const changedMetadata = {
    ...mapStyle.metadata
  };
  delete changedMetadata['maputnik:azuremaps_subscription_key'];
  delete changedMetadata['maputnik:mapbox_access_token'];
  delete changedMetadata['maputnik:openmaptiles_access_token'];
  return {
    ...mapStyle,
    metadata: changedMetadata
  };
}

/** Azure Maps Parameters */
// us prefix so creator is sounds without additional logic
const azMapsDomain = 'us.atlas.microsoft.com';
const globalAzMapsDomain = 'atlas.microsoft.com';
const azMapsStylingPath = 'styling';
const azMapsLanguage = 'en-US';
const azMapsView = 'Auto';
const apiVersion = '2.0';

function isAzureMapsStyle(mapStyle) {
  const styleId = mapStyle.id;
  console.log('StyleId: ',styleId);
  return styleId && styleId.startsWith('azmaps-');
}

function toAzureMapsSprite(sprite) {
  if (sprite.includes('{{azMapsDomain}}') === false) return sprite;
  return sprite.replace('{{azMapsDomain}}', azMapsDomain)
               .replace('{{azMapsStylingPath}}', azMapsStylingPath)
               +`&api-version=${apiVersion}`;
}

function toAzureMapGlyphs(glyphs) {
  if (glyphs.includes('{{azMapsDomain}}') === false) return glyphs;
  return glyphs.replace('{{azMapsDomain}}', azMapsDomain)
               .replace('{{azMapsStylingPath}}', azMapsStylingPath)
               +`?api-version=${apiVersion}`;
}

function toAzureMapSourceUrl(sourceUrl, subscriptionKey, tilesetId) {
  if (sourceUrl.includes('{{azMapsDomain}}') === false) return sourceUrl;
  return sourceUrl.replace('{{azMapsDomain}}', azMapsDomain)
                  .replace('{{azMapsLanguage}}', azMapsLanguage)
                  .replace('{{azMapsView}}', azMapsView)
                  .replace('{tilesetId}', tilesetId)
                  +'&subscription-key=' + subscriptionKey;
}

function toAzureMapsStyle (originalStyle, subscriptionKey, tilesetId) {

  const style = cloneDeep(originalStyle);

  style['sprite'] = toAzureMapsSprite(style['sprite']);
  style['glyphs'] = toAzureMapGlyphs(style['glyphs']);

  for (const sourceKey in style['sources']) {
    const source = style.sources[sourceKey];
    if (sourceKey === 'vectorTiles' || sourceKey === 'satelliteSource') {
      source.url = toAzureMapSourceUrl(source.url, subscriptionKey, tilesetId)
    } else if('tiles' in source) {
      source.tiles = source.tiles.map(url => toAzureMapSourceUrl(url, subscriptionKey, tilesetId));
    }
  }

  // hack: for now
  style.layers.filter(layer => layer.layout !== undefined).forEach(layer => {
    layer.layout.visibility = 'visible'
  });

  return style;
}

function generateAzureMapsStyleId(baseStyleName) {
  return 'azmaps-' + baseStyleName[0].toLowerCase() + baseStyleName.slice(1) + '-' + generateId();
}

export default {
  ensureStyleValidity,
  emptyStyle,
  indexOfLayer,
  generateId,
  getAccessToken,
  replaceAccessTokens,
  stripAccessTokens,
  isAzureMapsStyle,
  toAzureMapsStyle,
  generateAzureMapsStyleId,
  toAzureMapsSprite,
  toAzureMapGlyphs,
  toAzureMapSourceUrl,
  azMapsDomain,
  globalAzMapsDomain
}
