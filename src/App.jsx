import React, { useEffect, useState, useRef } from 'react';
import mqtt from 'mqtt';
import { Droplets, AlertTriangle, Settings, X } from 'lucide-react';
import './App.css';

const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const TOPIC_STATUS = 'home/watertanks/status';
const TOPIC_SETTINGS = 'home/watertanks/settings';

const defaultNames = { tank1: "Main Ground", tank2: "Roof Tank 1", tank3: "Roof Tank 2", tank4: "Rainwater" };
const defaultHeights = { tank1: 200, tank2: 200, tank3: 200, tank4: 200 };

function App() {
  const [tankLevels, setTankLevels] = useState({ tank1: 0, tank2: 0, tank3: 0, tank4: 0 });
  const [tankNames, setTankNames] = useState(defaultNames);
  const [tankHeights, setTankHeights] = useState(defaultHeights);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTank, setActiveTank] = useState('tank1');
  const [editName, setEditName] = useState('');
  const [editHeight, setEditHeight] = useState(200);

  const clientRef = useRef(null);

  useEffect(() => {
    // Load from local storage initially
    const storedNames = localStorage.getItem('tankNames');
    const storedHeights = localStorage.getItem('tankHeights');
    if (storedNames) setTankNames(JSON.parse(storedNames));
    if (storedHeights) setTankHeights(JSON.parse(storedHeights));

    const clientId = 'web-dashboard-' + Math.random().toString(16).substr(2, 8);
    const client = mqtt.connect(BROKER_URL, { clientId });
    clientRef.current = client;

    client.on('connect', () => {
      setConnected(true);
      client.subscribe(TOPIC_STATUS);
      client.subscribe(TOPIC_SETTINGS); // Subscribe to settings to sync across devices
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (topic === TOPIC_STATUS) {
          setTankLevels({
            tank1: data.tank1 ?? tankLevels.tank1,
            tank2: data.tank2 ?? tankLevels.tank2,
            tank3: data.tank3 ?? tankLevels.tank3,
            tank4: data.tank4 ?? tankLevels.tank4
          });
          setLastUpdated(new Date());
        } 
        else if (topic === TOPIC_SETTINGS) {
          // Sync names and heights from other devices (like PC to Mobile)
          if (data.name1 !== undefined) {
            const syncedNames = { tank1: data.name1, tank2: data.name2, tank3: data.name3, tank4: data.name4 };
            setTankNames(syncedNames);
            localStorage.setItem('tankNames', JSON.stringify(syncedNames));
          }
          if (data.tank1 !== undefined) {
            const syncedHeights = { tank1: data.tank1, tank2: data.tank2, tank3: data.tank3, tank4: data.tank4 };
            setTankHeights(syncedHeights);
            localStorage.setItem('tankHeights', JSON.stringify(syncedHeights));
          }
        }
      } catch (e) {
        console.error("Error parsing message:", e);
      }
    });

    client.on('disconnect', () => setConnected(false));
    client.on('offline', () => setConnected(false));

    return () => client.end();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = (key) => {
    setActiveTank(key);
    setEditName(tankNames[key]);
    setEditHeight(tankHeights[key]);
    setIsModalOpen(true);
  };

  const saveSettings = (e) => {
    e.preventDefault();
    const newNames = { ...tankNames, [activeTank]: editName };
    const newHeights = { ...tankHeights, [activeTank]: Number(editHeight) };
    
    // Update locally instantly for snappy UI
    setTankNames(newNames);
    setTankHeights(newHeights);
    localStorage.setItem('tankNames', JSON.stringify(newNames));
    localStorage.setItem('tankHeights', JSON.stringify(newHeights));
    
    // Broadcast the new names AND heights to all other devices (like your phone) and the ESP32
    if (clientRef.current && clientRef.current.connected) {
      const payload = {
        tank1: newHeights.tank1, tank2: newHeights.tank2, tank3: newHeights.tank3, tank4: newHeights.tank4,
        name1: newNames.tank1, name2: newNames.tank2, name3: newNames.tank3, name4: newNames.tank4
      };
      // Use retain: true so if a phone connects later, it immediately gets the newest names
      clientRef.current.publish(TOPIC_SETTINGS, JSON.stringify(payload), { retain: true });
    }
    
    setIsModalOpen(false);
  };

  return (
    <div className="dashboard">
      <header className="header">
        <div className="header-title">
          <Droplets className="icon-blue" size={28} />
          <h1>Water System</h1>
        </div>
        <div className="status-container">
          {lastUpdated && <span className="last-updated">Updated: {lastUpdated.toLocaleTimeString()}</span>}
          <div className="status-badge">
            <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
            {connected ? 'Live' : 'Offline'}
          </div>
        </div>
      </header>

      <main className="tank-grid">
        {['tank1', 'tank2', 'tank3', 'tank4'].map((key) => (
          <TankCard 
            key={key} 
            name={tankNames[key]} 
            level={tankLevels[key]} 
            onClick={() => openModal(key)} 
          />
        ))}
      </main>

      {/* Settings Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Tank Settings</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={saveSettings}>
              <div className="form-group">
                <label>Tank Name</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label>Tank Depth (cm)</label>
                <input 
                  type="number" 
                  min="10" 
                  max="1000" 
                  value={editHeight} 
                  onChange={(e) => setEditHeight(e.target.value)} 
                  required 
                />
                <small className="help-text">Distance from sensor to the bottom of the tank.</small>
              </div>
              
              <button type="submit" className="save-btn">Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getTankColors(level) {
  let h;
  if (level <= 20) {
    h = 0; // Solid Red (Critical Low)
  } else if (level <= 70) {
    // Red (360) through purples into Green (150)
    let p = (level - 20) / 50;
    h = 360 - (210 * p);
  } else if (level <= 85) {
    h = 150; // Solid Green (Normal operating level)
  } else {
    // Green (150) into Blue (210) (Full)
    let p = (level - 85) / 15;
    h = 150 + (60 * p);
  }
  return {
    colorTop: `hsl(${Math.round(h)}, 85%, 60%)`,
    colorBottom: `hsl(${Math.round(h)}, 85%, 45%)`
  };
}

function TankCard({ name, level, onClick }) {
  const clampedLevel = Math.max(0, Math.min(100, level));
  const { colorTop, colorBottom } = getTankColors(clampedLevel);

  return (
    <div 
      className="tank-card clickable" 
      onClick={onClick}
      style={{ '--tank-color-top': colorTop, '--tank-color-bottom': colorBottom }}
    >
      <div className="tank-info-top">
        <h2>{name}</h2>
        <div className="header-icons">
          {clampedLevel <= 20 && <AlertTriangle className="icon-warning" size={16} />}
          <Settings className="icon-settings" size={16} />
        </div>
      </div>
      
      <div className="tank-layout">
        <div className="tank-graphic-wrapper">
          <div className="tank-outline">
            <div className="tank-liquid" style={{ height: `${clampedLevel}%` }}>
              <div className="wave"></div>
            </div>
          </div>
        </div>
        
        <div className="tank-stats">
          <span className="tank-percentage">{clampedLevel}<span className="percent-sign">%</span></span>
          <span className="tank-label">Current Level</span>
        </div>
      </div>
    </div>
  );
}

export default App;
