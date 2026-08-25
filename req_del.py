
import urllib.request
import urllib.error

url = 'https://spiritualmacaw-evolution.cloudfy.live/instance/delete/InstanciaAlpha2'
headers = {
    'apikey': '287D4B9B-DB51-499A-A4EC-672C70F311C2',
    'User-Agent': 'Mozilla/5.0'
}
req = urllib.request.Request(url, headers=headers, method='DELETE')
try:
    response = urllib.request.urlopen(req)
    print('Deleted:', response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('Error deleting:', e.read().decode('utf-8'))

