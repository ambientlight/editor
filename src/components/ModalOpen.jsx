import React from 'react'
import PropTypes from 'prop-types'
import ModalLoading from './ModalLoading'
import Modal from './Modal'
import InputButton from './InputButton'
import FileReaderInput from 'react-file-reader-input'
import InputUrl from './InputUrl'
import InputString from './InputString'
import InputSelect from './InputSelect'

import {MdAddCircleOutline, MdDelete, MdFileUpload, MdCheckCircle, MdRadioButtonUnchecked, MdCached} from 'react-icons/md'

import style from '../libs/style.js'
import publicStyles from '../config/styles.json'

import AzureMapsClientV2 from '../clients/azureMapsClientV2'
import { readFileAsArrayBuffer } from '../libs/file'

class PublicStyle extends React.Component {
  static propTypes = {
    url: PropTypes.string.isRequired,
    thumbnailUrl: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    onSelect: PropTypes.func.isRequired,
  }

  render() {
    return <div className="maputnik-public-style">
      <InputButton
        className="maputnik-public-style-button"
        aria-label={this.props.title}
        onClick={() => this.props.onSelect(this.props.url)}
      >
        <div className="maputnik-public-style-header">
          <div>{this.props.title}</div>
          <span className="maputnik-space" />
          <MdAddCircleOutline />
        </div>
        <div
          className="maputnik-public-style-thumbnail"
          style={{
            backgroundImage: `url(${this.props.thumbnailUrl})`
          }}
        ></div>
      </InputButton>
    </div>
  }
}

const progressInitState = {
  data: {
    status: "Waiting",
    operationId: "",
    udid: ""
  },
  conversion: {
    status: "Waiting",
    operationId: "",
    conversionId: ""
  },
  dataset: {
    status: "Waiting",
    operationId: "",
    datasetId: ""
  },
  tileset: {
    status: "Waiting",
    operationId: "",
    tilesetId: ""
  }
};

const isUploadIdle = state =>
  [state.data.status, state.conversion.status, state.dataset.status, state.tileset.status]
    .reduce((isIdle, status) => isIdle && status === 'Waiting', true);

const uploadStatus = state =>
  state.data.status === "Running" ? "uploading..."
  : state.conversion.status === "Running" ? "converting..."
  : state.dataset.status === "Running" ? "creating dataset..."
  : state.tileset.status === "Running" ? "creating tileset..."
  : "done";

export default class ModalOpen extends React.Component {
  static propTypes = {
    isOpen: PropTypes.bool.isRequired,
    isInitialVisit: PropTypes.bool,
    onOpenToggle: PropTypes.func.isRequired,
    onStyleOpen: PropTypes.func.isRequired,
    mapStyle: PropTypes.object
  }

  constructor(props) {
    super(props);
    this.state = {
      stylesUrl: "",
      /* Azure Maps State */

      subscriptionKey: ENVIRONMENT.subscriptionKey,
      externalKey: ENVIRONMENT.subscriptionKey,

      // Tilesets
      tilesets: [],
      selectedTilesetId: "",

      customStyleset: null,
      ...progressInitState
    };

    this.resolveTilesets(this.state.subscriptionKey);
    this.client = null;
  }

  initClient = (subscriptionKey) => {
    this.client = new AzureMapsClientV2(subscriptionKey);
  }

  resetProgressState = () => {
    this.setState(progressInitState)
  }

  onDWGUpload = async (_, files) => {
    this.resetProgressState();
    this.initClient(this.state.subscriptionKey);
    const [_e, file] = files[0];

    this.setState({ data: { ...this.state.data, status: "Running" }});
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const { resourceId: udid } = await this.upload(arrayBuffer);
    this.setState({ data: { ...this.state.data, status: "Succeeded", udid }});

    this.setState({ conversion: { ...this.state.conversion, status: "Running" }});
    const { resourceId: conversionId} = await this.convert(udid);
    this.setState({ conversion: { ...this.state.conversion, status: "Succeeded", conversionId }});

    this.setState({ dataset: { ...this.state.dataset, status: "Running" }});
    const { resourceId: datasetId} = await this.createDataset(conversionId);
    this.setState({ dataset: { ...this.state.dataset, status: "Succeeded", datasetId }});

    this.setState({ tileset: { ...this.state.tileset, status: "Running" }});
    const { resourceId: tilesetId} = await this.createTileset(datasetId);
    this.setState({ tileset: { ...this.state.tileset, status: "Succeeded", tilesetId }});

    this.resolveTilesets(this.state.subscriptionKey, tilesetId);
  }

  upload = async (arrayBuffer) => {
    const response = await this.client.uploadPackage(arrayBuffer);
    this.setState({ data: { ...this.state.data, operationId: response.operationId }});
    return this.client.getOperationStatusUntilSucceed("data", response.operationId, 1000);
  }

  convert = async (udid) => {
    const response = await this.client.convertPackage(udid);
    this.setState({ conversion: { ...this.state.conversion, operationId: response.operationId }});
    return this.client.getOperationStatusUntilSucceed("conversion", response.operationId, 1000);
  }

  createDataset = async (conversionid) => {
    const response = await this.client.createDataset(conversionid);
    this.setState({ dataset: { ...this.state.dataset, operationId: response.operationId }});
    return this.client.getOperationStatusUntilSucceed("dataset", response.operationId, 1000);
  }

  createTileset = async (datasetId) => {
    const response = await this.client.createTileset(datasetId);
    this.setState({ tileset: { ...this.state.tileset, operationId: response.operationId }});
    return this.client.getOperationStatusUntilSucceed("tileset", response.operationId, 1000);
  }

  clearError() {
    this.setState({
      error: null
    })
  }

  onCancelActiveRequest(e) {
    // Else the click propagates to the underlying modal
    if(e) e.stopPropagation();

    if(this.state.activeRequest) {
      this.state.activeRequest.abort();
      this.setState({
        activeRequest: null,
        activeRequestUrl: null
      });
    }
  }

  onLoadAzureMapsBaseStyleFromGallery = (name, baseUrl, subscriptionKey, selectedTilesetId) => {

    this.clearError();

    let canceled;

    const activeRequest = fetch(baseUrl, {
      mode: 'cors',
      credentials: "same-origin"
    })
    .then(function(response) {
      return response.json();
    })
    .then((body) => {
      if(canceled) {
        return;
      }

      this.setState({
        activeRequest: null,
        activeRequestUrl: null
      });

      body['id'] = style.generateAzureMapsStyleId(name);

      // fill back the subscription key in style metadata as it will be used as a state in root App component
      body['metadata'] = {
        ...(body['metadata'] || {}),
        'maputnik:azuremaps_subscription_key': subscriptionKey,
        'maputnik:azuremaps_tileset_id': selectedTilesetId,
        'maputnik:azuremaps_tileset_bbox': this.state.tilesets.filter(tileset => tileset.tilesetId === selectedTilesetId).map(tileset => tileset.bbox)[0]
      }

      const mapStyle = style.ensureStyleValidity(body)

      this.props.onStyleOpen(mapStyle)
      this.onOpenToggle()
    })
    .catch((err) => {
      this.setState({
        error: `Failed to load: '${baseUrl}'`,
        activeRequest: null,
        activeRequestUrl: null
      });
      console.error(err);
      console.warn('Could not open the style URL', baseUrl)
    })

    this.setState({
      activeRequest: {
        abort: function() {
          canceled = true;
        }
      },
      activeRequestUrl: baseUrl
    })
  }

  onStyleSelect = (stylesUrl) => {
    this.clearError();

    let canceled;

    const activeRequest = fetch(stylesUrl, {
      mode: 'cors',
      credentials: "same-origin"
    })
    .then(function(response) {
      return response.json();
    })
    .then((body) => {
      if(canceled) {
        return;
      }

      this.setState({
        activeRequest: null,
        activeRequestUrl: null
      });

      const mapStyle = style.ensureStyleValidity(body)
      console.log('Loaded style ', mapStyle.id)
      this.props.onStyleOpen(mapStyle)
      this.onOpenToggle()
    })
    .catch((err) => {
      this.setState({
        error: `Failed to load: '${stylesUrl}'`,
        activeRequest: null,
        activeRequestUrl: null
      });
      console.error(err);
      console.warn('Could not open the style URL', stylesUrl)
    })

    this.setState({
      activeRequest: {
        abort: function() {
          canceled = true;
        }
      },
      activeRequestUrl: stylesUrl
    })
  }

  onSubmitUrl = (e) => {
    e.preventDefault();
    this.onStyleSelect(this.state.stylesUrl);
  }

  onUpload = (_, files) => {
    const [e, file] = files[0];
    const reader = new FileReader();

    this.clearError();

    reader.readAsText(file, "UTF-8");
    reader.onload = e => {
      let mapStyle;
      try {
        mapStyle = JSON.parse(e.target.result)
      }
      catch(err) {
        this.setState({
          error: err.toString()
        });
        return;
      }
      mapStyle = style.ensureStyleValidity(mapStyle)
      this.props.onStyleOpen(mapStyle);
      this.onOpenToggle();
    }
    reader.onerror = e => console.log(e.target);
  }

  onOpenToggle() {
    this.setState({
      stylesUrl: ""
    });
    this.clearError();
    this.props.onOpenToggle();
  }

  onChangeBaseStyle = (style) => {
    this.setState({
      selectedBaseStyle: style
    });
  }

  onLoadCreatorStyle = () => {}

  componentDidMount = () => {
    const metadata = this.props.mapStyle.metadata || {};
    const subscriptionKey = metadata['maputnik:azuremaps_subscription_key'] || ENVIRONMENT.subscriptionKey;
    this.setState({
      subscriptionKey
    })

    this.resolveTilesets(subscriptionKey);
  }

  componentDidUpdate = () => {
    const metadata = this.props.mapStyle.metadata || {};
    const subscriptionKey = metadata['maputnik:azuremaps_subscription_key'] || ENVIRONMENT.subscriptionKey;
    if(this.state.externalKey !== subscriptionKey){
      this.setState({ externalKey: subscriptionKey })
      this.resolveTilesets(subscriptionKey);
    }
  }

  resolveTilesets = (key, selectedTilesetId) => {
    const subscriptionKey = key.trim()
    if(subscriptionKey.length != 43){ return; }

    this.setState({ error: null });

    fetch(`https://us.atlas.microsoft.com/tilesets?api-version=2.0&subscription-key=${subscriptionKey}`)
      .then(response => response.json())
      .then(data =>
        this.setState({
          tilesets: [{ description: '(Please select)', tilesetId: '' }, ...data.tilesets],
          selectedTilesetId,
          error: null
        }))
      .catch(error => {
        console.error(error);
        this.setState({ error });
      });
  }

  resolveStyleset = () =>
    fetch(this.state.stylesUrl)
      .then(response => response.json())
      .then(data => this.setState({ customStyleset: data }))
      .catch(error => {
        console.error(error);
        this.setState({ error });
      });

  render() {
    const metadata = this.props.mapStyle.metadata || {};
    const subscriptionKey = this.state.subscriptionKey || this.state.externalKey;
    const tilesetId = this.state.selectedTilesetId;

    let styleOptions = [];
    if(this.state.customStyleset){
      styleOptions = this.state.customStyleset.styles.filter(style => this.state.selectedTilesetId ? style.name.includes('indoor') : !style.name.includes('indoor')).map(style => {
        const url = `https://atlas.microsoft.com/styling/styles/${style.name}?api-version=2.0&version=2021-02-01`
        const matchingPublicStyle = publicStyles.find(publicStyle => publicStyle.id === style.name)
        const thumbnailUrl = matchingPublicStyle !== undefined
          ? matchingPublicStyle.thumbnail
          : style.thumbnail
            .replace('{{azMapsStylingPath}}', 'https://atlas.microsoft.com/styling')
            .replace('{{azMapsStylePath}}', 'styles');

        return <PublicStyle
          key={style.name}
          url={url}
          title={style.name}
          thumbnailUrl={thumbnailUrl}
          onSelect={() => this.onLoadAzureMapsBaseStyleFromGallery(style.name, url, subscriptionKey, tilesetId)}
        />
      })
    } else {
      styleOptions = publicStyles.filter(style => this.state.selectedTilesetId ? style.id.includes('indoor') : !style.id.includes('indoor')).map(style => {
        return <PublicStyle
          key={style.id}
          url={style.url}
          title={style.title}
          thumbnailUrl={style.thumbnail}
          onSelect={() => this.onLoadAzureMapsBaseStyleFromGallery(style.id, style.url, subscriptionKey, tilesetId)}
        />
      })
    }

    let errorElement;
    if(this.state.error) {
      errorElement = (
        <div className="maputnik-modal-error">
          {this.state.error}
          <a href="#" onClick={() => this.clearError()} className="maputnik-modal-error-close">×</a>
        </div>
      );
    }

    const progressIcons = {
      "Waiting": <MdRadioButtonUnchecked />,
      "Running": <MdCached className="spinner" />,
      "Succeeded": <MdCheckCircle />
    };

    let wellcomeMessage = this.props.isInitialVisit ? 'Welcome to Azure Maps Maputnik style editor!' : 'Open Style';

    return  (
      <div>
        <Modal
          data-wd-key="modal:open"
          isOpen={this.props.isOpen}
          onOpenToggle={() => this.onOpenToggle()}
          title={wellcomeMessage}
        >
          {errorElement}

          <section className="maputnik-modal-selection" style={{marginBottom: '24px' }}>
            <h4 style={{ color: '#a4a4a4' }}>
              Azure Maps Maputnik is a visual style editor for Azure Maps,
              get started customizing your own map by inserting a subscription key and selecting a base style that you want to customize.
            </h4>
          </section>

          <section className="maputnik-modal-selection">
            {/* Subscription Key */}
            <h1>Step 1: Subscription Key</h1>
            <InputString
                aria-label="Subscription key"
                data-wd-key="modal:open.subscriptionkey.input"
                type="text"
                className="maputnik-input"
                default="your Azure Maps subscription key"
                value={subscriptionKey}
                disabled={false}
                onInput={subscriptionKey => {
                  console.log(subscriptionKey)
                  this.setState({ subscriptionKey })
                  this.resolveTilesets(subscriptionKey)
                }}
              />
          </section>

          <div style={ subscriptionKey && subscriptionKey.length == 43 ? {} : { filter: 'opacity(0.2)', pointerEvents: 'none' } }>
            <section className="maputnik-modal-section">
              <h1>Step 2: (Optional) Add Indoor Tileset</h1>
              {/* Tilesets */}
              <p>You may also customize the appearance of your indoor maps. <br/> Select an indoor map tileset or upload a new DWG floor plan package that satisfies <a href="https://docs.microsoft.com/en-us/azure/azure-maps/drawing-requirements"> package requirements </a></p>
              <InputSelect
                options={this.state.tilesets.map(t => [t.tilesetId, t.description || t.tilesetId])}
                onChange={selectedTilesetId => {
                  this.setState({ selectedTilesetId })
                }}
                value={this.state.selectedTilesetId}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* <InputButton
                  data-wd-key="modal:open.tileset.button"
                  type="button"
                  className="maputnik-big-button"
                  onClick={this.onLoadCreatorStyle}
                  disabled={!subscriptionKey || !this.state.selectedTilesetId}
                >Load creator style</InputButton> */}

                <div style={{ display: 'flex' }}>
                  <FileReaderInput onChange={this.onDWGUpload} className="maputnik-big-button" tabIndex="-1" aria-label="Style file" style={{ marginRight: '8px' }}>
                    <InputButton className="maputnik-upload-button"><MdFileUpload /> Upload DWG Package</InputButton>
                  </FileReaderInput>

                  <p style={{ paddingTop: '16px', display: isUploadIdle(this.state) ? 'none' : 'initial' }}>
                    { uploadStatus(this.state) }
                  </p>
                </div>

                <div className="progress-icons" style={{ display: isUploadIdle(this.state) ? 'none' : 'initial' }}>
                  {progressIcons[this.state.data.status]}
                  {progressIcons[this.state.conversion.status]}
                  {progressIcons[this.state.dataset.status]}
                  {progressIcons[this.state.tileset.status]}
                </div>
              </div>
            </section>

            {/* <section className="maputnik-modal-section">
              <form onSubmit={this.onSubmitUrl}>
                <h1>Load from URL</h1>
                <p>
                  Load from a URL. Note that the URL must have <a href="https://enable-cors.org" target="_blank" rel="noopener noreferrer">CORS enabled</a>.
                </p>
                <InputUrl
                  aria-label="Style URL"
                  data-wd-key="modal:open.url.input"
                  type="text"
                  className="maputnik-input"
                  default="Enter URL..."
                  value={this.state.stylesUrl}
                  onInput={this.onChangeUrl}
                  onChange={this.onChangeUrl}
                />
                <div>
                  <InputButton
                    data-wd-key="modal:open.url.button"
                    type="submit"
                    className="maputnik-big-button"
                    disabled={this.state.stylesUrl.length < 1}
                  >Load from URL</InputButton>
                </div>
              </form>
            </section> */}

            <section className="maputnik-modal-section maputnik-modal-section--shrink">
              <h1>Step 3: Select style </h1>

                <p>
                  You may choose from alternative styleset by customizing styles API URL. <br/> Note that the URL must have <a href="https://enable-cors.org" target="_blank" rel="noopener noreferrer">CORS enabled</a>.
                </p>
                <InputUrl
                  aria-label="Style URL"
                  data-wd-key="modal:open.url.input"
                  type="text"
                  className="maputnik-input"
                  default="https://atlas.microsoft.com/styling/styles?api-version=2.0&version=2021-02-01"
                  value={this.state.stylesUrl}
                  onInput={(stylesUrl) => this.setState({ stylesUrl })}
                  onChange={(stylesUrl) => this.setState({ stylesUrl })}
                />
                <div>
                  <InputButton
                    data-wd-key="modal:open.url.button"
                    type="submit"
                    className="maputnik-big-button"
                    disabled={this.state.stylesUrl.length < 10}
                    onClick={() => this.resolveStyleset()}
                  >Load</InputButton>
                </div>

              <p style={{ marginTop: '16px' }}>
                Select a base style you intend to edit.
              </p>
              <div className="maputnik-style-gallery-container">
              {styleOptions}
              </div>
            </section>
          </div>

          <section className="maputnik-modal-section">
            <h1>Upload your own style instead</h1>
            <p>Upload a JSON style from your computer.</p>
            <FileReaderInput onChange={this.onUpload} tabIndex="-1" aria-label="Style file">
              <InputButton className="maputnik-upload-button"><MdFileUpload /> Upload</InputButton>
            </FileReaderInput>
          </section>

        </Modal>

        <ModalLoading
          isOpen={!!this.state.activeRequest}
          title={'Loading style'}
          onCancel={(e) => this.onCancelActiveRequest(e)}
          message={"Loading: "+this.state.activeRequestUrl}
        />
      </div>
    )
  }
}

