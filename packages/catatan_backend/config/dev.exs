import Config

# For development, we disable any cache and enable
# debugging and code reloading.
#
# The watchers configuration can be used to run external
# watchers to your application. For example, we can use it
# to bundle .js and .css sources.
config :catatan_backend, CatatanBackendWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.get_env("PORT") || "8000")],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "Z1oSHehZ7vBBzCC27KhTqI7B+Yo5WYkMuuEKnYSVtBTakvghYjZL/CumR0vRsFGa",
  watchers: []

config :catatan_backend, CatatanBackend.CassandraClient,
  nodes: [System.get_env("CATATAN_KEYSPACES_NODE_HOST")],
  authentication:
    {Xandra.Authenticator.Password,
     username: System.get_env("CATATAN_KEYSPACES_USERNAME"),
     password: System.get_env("CATATAN_KEYSPACES_PASSWORD")},
  keyspace: System.get_env("CATATAN_KEYSPACES_NAME"),
  encryption: true,
  transport_options: [
    cacertfile: Path.join([File.cwd!(), ".resource", "keyspaces-bundle.pem"])
  ]

# Enable dev routes for dashboard and mailbox
config :catatan_backend, dev_routes: true

# Do not include metadata nor timestamps in development logs
config :logger, :default_formatter, format: "[$level] $message\n"

# Set a higher stacktrace during development. Avoid configuring such
# in production as building large stacktraces may be expensive.
config :phoenix, :stacktrace_depth, 20

# Initialize plugs at runtime for faster development compilation
config :phoenix, :plug_init_mode, :runtime

# Disable swoosh api client as it is only required for production adapters.
config :swoosh, :api_client, false
