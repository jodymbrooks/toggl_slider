import React, { Component } from 'react';
import './App.css';
import TogglSlider from './TogglSlider';

class App extends Component {
  render() {
    return (
      <div className="App" style={{padding: '100px'}}>
        <TogglSlider className="TogglSlider" />
      </div>
    );
  }
}

export default App;
