#!/usr/bin/env python3
"""
Quick test script to verify Moolre USSD format works
"""
import requests
import json

# Test data matching Moolre format
test_request = {
    "sessionId": "test-session-123",
    "new": True,
    "msisdn": "233241235993",
    "network": 3,  # MTN
    "message": "",
    "extension": "178",
    "data": ""
}

def test_moolre_ussd():
    url = "http://localhost:8000/ussd"
    headers = {"Content-Type": "application/json"}
    
    try:
        print("Testing Moolre USSD format...")
        print(f"Request: {json.dumps(test_request, indent=2)}")
        
        response = requests.post(url, json=test_request, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Message: {data.get('message')}")
            print(f"Reply: {data.get('reply')}")
        
    except requests.exceptions.ConnectionError:
        print("Server not running. Start with: uvicorn app.main:app --reload --port 8000")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_moolre_ussd()