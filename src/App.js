import logo from './logo.svg';
import './App.css';
import CandleSimulation from './candlesim';

function App() {
  return (
    <div className="App">
      <CandleSimulation width={400} height={600} />
    </div>
  );
}

export default App;
