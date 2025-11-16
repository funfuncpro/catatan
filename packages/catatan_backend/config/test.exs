import Config

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :catatan_backend, CatatanBackendWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "SXla7JAodM+h89cJ9vtg/bHcJIgafQaTDmAq4OlIEYWLNEZ8FlY7v8h9IIM8OAAf",
  server: false

# In test we don't send emails
config :catatan_backend, CatatanBackend.Mailer, adapter: Swoosh.Adapters.Test

# Disable swoosh api client as it is only required for production adapters
config :swoosh, :api_client, false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

config :catatan_backend, CatatanBackend.CassandraClient,
  nodes: ["localhost:9042"],
  authentication: {
    Xandra.Authenticator.Password,
    username: "test", password: "test"
  },
  keyspace: "test_keyspace",
  encryption: false

config :catatan_backend, CatatanBackend.Replica, replica_id: "test_replica"
