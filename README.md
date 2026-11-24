# FlightMapWorld MCP server

Flight routes for AI assistants. Connect Claude, ChatGPT, Cursor or any other
[Model Context Protocol](https://modelcontextprotocol.io) client to
[FlightMapWorld](https://flightmapworld.com) and ask where an airport flies,
which airlines fly a route, how long the flight is, what it costs and where to
change planes when there is no nonstop flight.

```
https://flightmapworld.com/mcp
```

- **Free and public.** No account, no API key.
- **Remote.** Nothing to install: paste the address into your client.
- **Read-only.** Four tools that look things up and change nothing.
- **Worldwide.** About 10,000 airports, 60,000 routes with fares, and the
  airlines seen flying each nonstop route.

More about the server: [flightmapworld.com/mcp](https://flightmapworld.com/mcp).

## Connect

### Claude (claude.ai, desktop, mobile)

Settings, then Connectors, then "Add custom connector". Paste
`https://flightmapworld.com/mcp`. No authentication.

### Claude Code

```bash
claude mcp add --transport http flightmapworld https://flightmapworld.com/mcp
```

### ChatGPT

Settings, then Connectors (developer mode). Create a connector with the
address `https://flightmapworld.com/mcp` and "No authentication".

### Cursor

`~/.cursor/mcp.json`, or `.cursor/mcp.json` in a project:

```json
{
  "mcpServers": {
    "flightmapworld": {
      "url": "https://flightmapworld.com/mcp"
    }
  }
}
```

### VS Code

`.vscode/mcp.json`:

```json
{
  "servers": {
    "flightmapworld": {
      "type": "http",
      "url": "https://flightmapworld.com/mcp"
    }
  }
}
```

### Clients that only start local servers

Some clients cannot connect to a URL and only run a local program. This
repository is a small bridge for them: it passes each message to the remote
server and writes the answer back. It needs Node.js 18 or newer and has no
dependencies.

```json
{
  "mcpServers": {
    "flightmapworld": {
      "command": "npx",
      "args": ["-y", "github:nocodeno/flightmapworld-mcp"]
    }
  }
}
```

This is the form the Claude Desktop settings file
(`claude_desktop_config.json`) takes, for example.

## Tools

| Tool | What it answers | Arguments |
| --- | --- | --- |
| `search_airports` | Airports by city, airport name, country or IATA code. Gives the code the other tools need. | `query`, `limit` (optional) |
| `get_route` | One route in full: nonstop or not, the airlines, flight time, distance, the cheapest dates with their fares, the lowest fare per month, and where fares with stops change planes. | `origin`, `destination`, `month` (optional, `YYYY-MM`) |
| `list_destinations` | Where you can fly from an airport, cheapest first, with the fare, the number of stops, the airline and the flight time. | `origin`, `nonstop_only`, `max_price_usd`, `country`, `limit` (all optional but `origin`) |
| `find_connections` | Ways to get between two airports with one or two stops, leg by leg: where to change, the airlines, flight time and lowest fare of each leg. | `origin`, `destination`, `max_stops` (optional) |

Airports are given as three-letter IATA codes (`OTP`, `LHR`, `JFK`). Fares are
in US dollars.

## Things to ask

- Where can I fly nonstop from Cluj for under 60 dollars?
- Which airlines fly from London Heathrow to Barcelona, and how long is the flight?
- What is the cheapest month to fly from Bucharest to Dubai?
- There is no direct flight from Krabi to Buenos Aires. Where would I change planes?
- I am in Lisbon in March. Which destinations in Italy are cheapest?

## What an answer looks like

`get_route` for Iasi (`IAS`) to Tenerife South (`TFS`), shortened:

```json
{
  "origin": { "iata": "IAS", "name": "Iasi Airport", "city": "Iasi", "country": "Romania" },
  "destination": { "iata": "TFS", "name": "Tenerife South Airport", "city": "Tenerife", "country": "Spain" },
  "distance_km": 4358,
  "nonstop": { "available": false },
  "lowest_fare_usd": 58.85,
  "cheapest_dates": [
    {
      "date": "2027-03-01",
      "departs": "23:30",
      "price_usd": 58.85,
      "stops": 1,
      "via": ["Milan (BGY)"],
      "airline": "Ryanair",
      "duration_minutes": 730,
      "book_url": "https://flightmapworld.com/routes/ias-iasi/tfs-tenerife/go?src=mcp&date=2027-03-01"
    }
  ],
  "lowest_fare_by_month_usd": { "2026-12": 94.01, "2027-01": 175, "2027-03": 58.85 },
  "ways_with_stops": [
    { "via": ["Milan (BGY)"], "from_price_usd": 58.85 },
    { "via": ["Dublin (DUB)"], "from_price_usd": 94.01 }
  ],
  "route_url": "https://flightmapworld.com/routes/ias-iasi/tfs-tenerife",
  "book_url": "https://flightmapworld.com/routes/ias-iasi/tfs-tenerife/go?src=mcp",
  "connections_url": "https://flightmapworld.com/connections/ias-iasi/tfs-tenerife"
}
```

Every result is returned twice, as text and as structured content, so it
works with clients that read either.

## Where the data comes from

The tools read the same data as the pages of
[flightmapworld.com](https://flightmapworld.com): fares that travellers found
in recent flight searches, and the routes, airlines and flight times read
from those results. Fares are the lowest one-way prices recently found. They
are observations, not live offers, and they change often. The full
description is in
[Data sources and methodology](https://flightmapworld.com/methodology).

Each answer carries links back to the site: `route_url` for the route page
with its price calendar and map, and `book_url` for the flight search with
the live price. Booking links are affiliate links to Aviasales. FlightMapWorld
may earn a commission when a flight is booked through them, at no extra cost
to the traveller.

## Fair use and privacy

The server is meant for people asking questions through an assistant. It
answers a generous number of requests a day per network and then asks the
assistant to try again later. It is not for copying the data in bulk.

It stores no conversation and no address, only daily counts of which tool was
called. Privacy page: [flightmapworld.com/privacy](https://flightmapworld.com/privacy).

## Protocol

- Transport: Streamable HTTP, one endpoint, POST only. Answers are plain JSON.
- Stateless: no session, no event stream.
- Protocol revisions: `2026-07-28` (per-request metadata, `server/discover`)
  and, for older clients, `2025-11-25`, `2025-06-18`, `2025-03-26` and
  `2024-11-05` (the `initialize` handshake).
- Server card: [flightmapworld.com/mcp/server-card](https://flightmapworld.com/mcp/server-card).
- Registry name: `com.flightmapworld/flights` (see `server.json`).

Try it from a terminal:

```bash
curl -s https://flightmapworld.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_airports","arguments":{"query":"Lisbon"}}}'
```

## More from FlightMapWorld

- [Interactive flight route map](https://flightmapworld.com/map)
- [Connection finder](https://flightmapworld.com/connections): routings with stops, drawn on a map
- [Flight deals](https://flightmapworld.com/deals)
- [Newly seen routes](https://flightmapworld.com/new-routes)

## License

The code and documentation in this repository are under the [MIT license](LICENSE).
The flight data behind the server is not part of the repository.
