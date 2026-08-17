const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://broker.hivemq.com');

let t1 = 50, t2 = 80, t3 = 10, t4 = 100;

client.on('connect', () => {
  console.log('ESP32 Simulator connected to MQTT');
  
  setInterval(() => {
    // Add some realistic random fluctuation
    t1 = Math.max(0, Math.min(100, t1 + (Math.random() * 10 - 5)));
    t2 = Math.max(0, Math.min(100, t2 + (Math.random() * 10 - 5)));
    t3 = Math.max(0, Math.min(100, t3 + (Math.random() * 10 - 5)));
    t4 = Math.max(0, Math.min(100, t4 + (Math.random() * 10 - 5)));

    const data = {
      tank1: Math.round(t1),
      tank2: Math.round(t2),
      tank3: Math.round(t3),
      tank4: Math.round(t4)
    };
    
    client.publish('home/watertanks/status', JSON.stringify(data));
    console.log('Published dummy data:', data);
  }, 2000);
});
