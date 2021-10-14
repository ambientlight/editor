import React from 'react'
import PropTypes from 'prop-types'
import ModalLoading from './ModalLoading'
import Modal from './Modal'
import InputButton from './InputButton'
import FileReaderInput from 'react-file-reader-input'
import InputUrl from './InputUrl'
import InputString from './InputString'
import InputSelect from './InputSelect'

import {MdFileUpload} from 'react-icons/md'
import {MdAddCircleOutline} from 'react-icons/md'

import style from '../libs/style.js'
import publicStyles from '../config/styles.json'

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

export default class ModalOpen extends React.Component {
  static propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onOpenToggle: PropTypes.func.isRequired,
    onStyleOpen: PropTypes.func.isRequired,
    mapStyle: PropTypes.object
  }

  constructor(props) {
    super(props);
    this.state = {
      styleUrl: "",
      /* Azure Maps State */

      // Tilesets
      tilesets: [],
      selectedTilesetId: "" || ENVIRONMENT.tilesetId,
    };
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

  onLoadAzureMapsBaseStyleFromGallery = (name, baseUrl, subscriptionKey) => {

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
        'maputnik:azuremaps_subscription_key': subscriptionKey
      }

      const mapStyle = style.ensureStyleValidity(body)

      console.log('Loaded style ', mapStyle.id)
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

  onLoadAzureMapsCreatorStyle = (tilesetId) => {
    // TODO
  }

  onStyleSelect = (styleUrl) => {
    this.clearError();

    let canceled;

    const activeRequest = fetch(styleUrl, {
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
        error: `Failed to load: '${styleUrl}'`,
        activeRequest: null,
        activeRequestUrl: null
      });
      console.error(err);
      console.warn('Could not open the style URL', styleUrl)
    })

    this.setState({
      activeRequest: {
        abort: function() {
          canceled = true;
        }
      },
      activeRequestUrl: styleUrl
    })
  }

  onSubmitUrl = (e) => {
    e.preventDefault();
    this.onStyleSelect(this.state.styleUrl);
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
      styleUrl: ""
    });
    this.clearError();
    this.props.onOpenToggle();
  }

  onChangeUrl = (url) => {
    this.setState({
      styleUrl: url,
    });
  }

  onChangeBaseStyle = (style) => {
    this.setState({
      selectedBaseStyle: style
    });
  }


  onChangeTileset = (tilesetId) => {
    this.setState({
      selectedTilesetId: tilesetId
    })
  }

  onLoadCreatorStyle = () => {
    this.onLoadAzureMapsCreatorStyle(this.state.selectedTilesetId);
  }

  componentDidUpdate = () => {
    const metadata = this.props.mapStyle.metadata || {};
    const subscriptionKey = metadata['maputnik:azuremaps_subscription_key'] || ENVIRONMENT.subscriptionKey;
    const subKeyErrorMessage = `Please set your Azure Maps subscription key on the 'Style Setting'.`;

    // Not SubscriptionKey
    if (!subscriptionKey && !this.state.error) {
      console.log("No SubKey");
      this.setState({
        // Not very UX friendly but ..
        error: subKeyErrorMessage
      });
    // Having Subscription but not yet retrieve tilesets data
    } else if (subscriptionKey && this.state.tilesets.length === 0)  {
      fetch(`https://us.atlas.microsoft.com/tilesets?api-version=2.0&subscription-key=${subscriptionKey}`)
      .then(response => response.json())
      .then(data => {
        this.setState({
          tilesets: [{ description: '(Please select)', tilesetId: '' }, ...data.tilesets],
          error: null
        })
      });
    // In case the error message is not cleared
    } else if (subscriptionKey && this.state.error === subKeyErrorMessage) {
      this.setState({
        error: null
      })
    }
  }

  render() {
    const metadata = this.props.mapStyle.metadata || {};
    const subscriptionKey = metadata['maputnik:azuremaps_subscription_key'] || ENVIRONMENT.subscriptionKey;

    const styleOptions = publicStyles.map(style => {
      return <PublicStyle
        key={style.id}
        url={style.url}
        title={style.title}
        thumbnailUrl={style.thumbnail}
        onSelect={() => this.onLoadAzureMapsBaseStyleFromGallery(style.id, style.url, subscriptionKey)}
      />
    })

    let errorElement;
    if(this.state.error) {
      errorElement = (
        <div className="maputnik-modal-error">
          {this.state.error}
          <a href="#" onClick={() => this.clearError()} className="maputnik-modal-error-close">×</a>
        </div>
      );
    }

    return  (
      <div>
        <Modal
          data-wd-key="modal:open"
          isOpen={this.props.isOpen}
          onOpenToggle={() => this.onOpenToggle()}
          title={'Open Style'}
        >
          {errorElement}

          <section className="maputnik-modal-selection">
            {/* Subscription Key */}
            <h1>Subscription Key</h1>
            <InputString
                aria-label="Subscription key"
                data-wd-key="modal:open.subscriptionkey.input"
                type="text"
                className="maputnik-input"
                default="No subscription key found"
                value={subscriptionKey}
                disabled={true}
              />
          </section>

          <section className="maputnik-modal-section">
            <h1>Azure Maps Creator Style</h1>
            {/* Tilesets */}
            <p>Select a indoor map tileset</p>
            <InputSelect
              options={this.state.tilesets.map(t => [t.tilesetId, t.description || t.tilesetId])}
              onChange={this.onChangeTileset}
              value={this.state.selectedTilesetId}
            />
            <div>
              <InputButton
                data-wd-key="modal:open.tileset.button"
                type="button"
                className="maputnik-big-button"
                onClick={this.onLoadCreatorStyle}
                disabled={!this.state.selectedTilesetId}
              >Load creator style</InputButton>
            </div>
          </section>

          <section className="maputnik-modal-section">
            <h1>Upload Style</h1>
            <p>Upload a JSON style from your computer.</p>
            <FileReaderInput onChange={this.onUpload} tabIndex="-1" aria-label="Style file">
              <InputButton className="maputnik-upload-button"><MdFileUpload /> Upload</InputButton>
            </FileReaderInput>
          </section>

          <section className="maputnik-modal-section">
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
                value={this.state.styleUrl}
                onInput={this.onChangeUrl}
                onChange={this.onChangeUrl}
              />
              <div>
                <InputButton
                  data-wd-key="modal:open.url.button"
                  type="submit"
                  className="maputnik-big-button"
                  disabled={this.state.styleUrl.length < 1}
                >Load from URL</InputButton>
              </div>
            </form>
          </section>

          <section className="maputnik-modal-section maputnik-modal-section--shrink">
            <h1>Azure Maps Styles</h1>
            <p>
              Select a base style.
            </p>
            <div className="maputnik-style-gallery-container">
            {styleOptions}
            </div>
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

