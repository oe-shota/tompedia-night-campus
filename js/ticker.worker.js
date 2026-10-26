// タブが裏に回っても止まらない合図（main.js の bgTicker が使う）
setInterval(()=>postMessage(0),50);
