#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / "index.html").read_text(encoding="utf-8")
js = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
readme = (ROOT / "README.md").read_text(encoding="utf-8")
north = (ROOT / "docs" / "MONEY-APP-NORTH-STAR.md").read_text(encoding="utf-8")

checks = {
    "consumer_title": "Money That Does More" in html,
    "consumer_hero": "Your money.<br><em>One place.</em>" in html,
    "add_money_primary": 'data-action="add-money">Add money' in html,
    "primary_send": '<b>Send</b><small>Pay a person or wallet</small>' in html,
    "primary_pay": '<b>Pay</b><small>Use your money online</small>' in html,
    "primary_grow": '<b>Grow</b><small>Own companies and assets</small>' in html,
    "primary_borrow": '<b>Borrow</b><small>Use supported value as collateral</small>' in html,
    "primary_play": '<b>Play</b><small>Games with real payoffs</small>' in html,
    "primary_ai": '<b>AI</b><small>Give an agent a budget</small>' in html,
    "money_card": "<b>Your Money</b>" in html,
    "activity_nav": "</span>Activity</button>" in html,
    "money_nav": "</span>Money</button>" in html,
    "grow_nav": "</span>Grow</button>" in html,
    "pay_nav": "</span>Pay</button>" in html,
    "send_nav": "</span>Send</button>" in html,
    "handler_add_money": "if(a==='add-money')" in js,
    "handler_send": "if(a==='send')" in js,
    "handler_pay": "if(a==='spend')" in js,
    "handler_grow": "if(a==='buy')" in js,
    "handler_borrow": "if(a==='borrow')" in js,
    "handler_play": "if(a==='play')" in js,
    "handler_ai": "if(a==='agent')" in js,
    "north_star_doc": "Intent → amount → source → preview → approve → execute → receipt" in north,
    "readme_positioning": "One money app to send, pay, grow, borrow, play, and give AI a budget." in readme,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("money app UX verification failed: " + ", ".join(failed))
print("money app UX verification passed:", len(checks), "checks")
