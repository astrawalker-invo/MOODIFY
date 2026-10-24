import asyncio
import json
import re
import sys
import time
import serial
import websockets

CONNECTED_CLIENTS = set()

# State variables
state = {
    "temperature": 29.0,
    "humidity": 60.0,
    "rainAnalog": 1023,
    "rainDigital": 1,
    "lastDht": time.time(),
    "lastRain": time.time(),
    "seq": 0,
    "dhtSeq": 0,
    "rainSeq": 0,
    "deviceId": "esp8266-USB-Live",
    "bootId": "LOCALBRIDGE001",
}

def make_snapshot():
    state["seq"] += 1
    now_ms = int(time.time() * 1000)
    dht_age = int((time.time() - state["lastDht"]) * 1000)
    rain_age = int((time.time() - state["lastRain"]) * 1000)

    t_val = round(state["temperature"], 2)
    h_val = round(state["humidity"], 2)
    a_val = min(1023, max(0, int(state["rainAnalog"])))
    d_val = 1 if state["rainDigital"] else 0

    return json.dumps({
        "schema_version": 1,
        "device_id": state["deviceId"],
        "boot_id": state["bootId"],
        "seq": state["seq"],
        "uptime_ms": now_ms % 100000000,
        "dht": {
            "sample_seq": state["dhtSeq"],
            "sample_age_ms": dht_age,
            "valid": True,
            "temperature_c": t_val,
            "humidity_percent": h_val,
        },
        "rain": {
            "sample_seq": state["rainSeq"],
            "sample_age_ms": rain_age,
            "valid": True,
            "analog": a_val,
            "digital": d_val,
        }
    })

async def broadcast_snapshot():
    if not CONNECTED_CLIENTS:
        return
    msg = make_snapshot()
    websockets.broadcast(CONNECTED_CLIENTS, msg)

async def ws_handler(websocket):
    CONNECTED_CLIENTS.add(websocket)
    print(f"[WebSocket] Client connected: {websocket.remote_address}")
    try:
        # Send initial snapshot immediately
        await websocket.send(make_snapshot())
        await websocket.wait_closed()
    finally:
        CONNECTED_CLIENTS.remove(websocket)
        print("[WebSocket] Client disconnected")

def read_serial_loop():
    ser = None
    port = "COM15"
    baud = 115200

    while True:
        try:
            if ser is None or not ser.is_open:
                print(f"[Serial] Connecting to {port} @ {baud}...")
                ser = serial.Serial(port, baud, timeout=1)
                print(f"[Serial] Connected to {port} successfully!")

            line = ser.readline().decode("utf-8", errors="replace").strip()
            if not line:
                time.sleep(0.01)
                continue

            # Check for direct JSON snapshot
            if line.startswith("SNAPSHOT:"):
                raw_json = line[len("SNAPSHOT:"):].strip()
                try:
                    data = json.loads(raw_json)
                    if "dht" in data and data["dht"].get("valid"):
                        state["temperature"] = float(data["dht"]["temperature_c"])
                        state["humidity"] = float(data["dht"]["humidity_percent"])
                        state["dhtSeq"] += 1
                        state["lastDht"] = time.time()
                    if "rain" in data:
                        state["rainAnalog"] = int(data["rain"]["analog"])
                        state["rainDigital"] = int(data["rain"]["digital"])
                        state["rainSeq"] += 1
                        state["lastRain"] = time.time()
                except Exception:
                    pass

            # Parse "Temperature: 31.00 °C" or similar
            m_t = re.search(r"Temperature:\s*([\d\.]+)", line, re.IGNORECASE)
            if m_t:
                state["temperature"] = float(m_t.group(1))
                state["dhtSeq"] += 1
                state["lastDht"] = time.time()
                print(f" -> Temp updated: {state['temperature']} C")

            # Parse "Humidity: 62.60 %"
            m_h = re.search(r"Humidity:\s*([\d\.]+)", line, re.IGNORECASE)
            if m_h:
                state["humidity"] = float(m_h.group(1))
                state["lastDht"] = time.time()
                print(f" -> Humidity updated: {state['humidity']} %")

            # Parse "Rain Analog Value: 1024"
            m_ra = re.search(r"Rain Analog(?:\s*Value)?:\s*(\d+)", line, re.IGNORECASE)
            if m_ra:
                val = int(m_ra.group(1))
                state["rainAnalog"] = min(1023, val)
                state["rainSeq"] += 1
                state["lastRain"] = time.time()
                print(f" -> Rain Analog: {state['rainAnalog']}")

            # Parse "Rain Digital Output: 1"
            m_rd = re.search(r"Rain Digital(?:\s*Output)?:\s*(\d+)", line, re.IGNORECASE)
            if m_rd:
                state["rainDigital"] = int(m_rd.group(1))
                state["lastRain"] = time.time()

        except serial.SerialException as e:
            if ser:
                ser.close()
            ser = None
            # Port busy or disconnected (e.g. Arduino IDE has it open)
            time.sleep(2)
        except Exception as e:
            print(f"[Serial error]: {e}")
            time.sleep(1)

async def ticker():
    while True:
        await broadcast_snapshot()
        await asyncio.sleep(0.5)

async def main():
    import threading
    t = threading.Thread(target=read_serial_loop, daemon=True)
    t.start()

    print("[Server] Starting WebSocket server on 0.0.0.0:81 ...")
    async with websockets.serve(ws_handler, "0.0.0.0", 81):
        print("[Server] WebSocket server running! Waiting for dashboard...")
        await ticker()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Stopped.")
