import React from 'react'
import PropTypes from 'prop-types'
import ScrollContainer from './ScrollContainer'

class AppLayout extends React.Component {
  static propTypes = {
    toolbar: PropTypes.element.isRequired,
    layerList: PropTypes.element.isRequired,
    layerEditor: PropTypes.element,
    map: PropTypes.element.isRequired,
    bottom: PropTypes.element,
    modals: PropTypes.node,
  }

  static childContextTypes = {
    reactIconBase: PropTypes.object
  }

  getChildContext() {
    return {
      reactIconBase: { size: 14 }
    }
  }

  render() {
    const drawerHeight = document.getElementById('maputnik-layer-editor')?.offsetHeight || 0

    return <div className="maputnik-layout">
      {this.props.toolbar}
      <div className="maputnik-layout-list">
        {this.props.layerList}
      </div>
      <div
        id="maputnik-layout-drawer" 
        className="maputnik-layout-drawer" 
        style={{height: drawerHeight}}>
        <ScrollContainer>
          {this.props.layerEditor}
        </ScrollContainer>
      </div>
      {this.props.map}
      {this.props.bottom && <div className="maputnik-layout-bottom">
          {this.props.bottom}
        </div>
      }
      {this.props.modals}
    </div>
  }
}

export default AppLayout
