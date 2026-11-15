$body = @{
    command = "color"
    color = @(255, 0, 0)
    priority = 50
    duration = 5000
} | ConvertTo-Json -Compress

$response = Invoke-RestMethod `
    -Uri "http://localhost:8099/json-rpc" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

$response | ConvertTo-Json -Depth 10