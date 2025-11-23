defmodule CatatanBackend.Application do
  @moduledoc false

  use Application
  @impl true
  def start(_type, _args) do
    queue_url = Application.get_env(:catatan_backend, CatatanBackend.SQS)[:url]

    children = [
      CatatanBackendWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:catatan_backend, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: CatatanBackend.PubSub},
      {Registry, keys: :unique, name: CatatanBackend.Notes.Registry},
      {DynamicSupervisor, strategy: :one_for_one, name: CatatanBackend.Notes.Supervisor},
      {Xandra,
       Keyword.put(
         Application.get_env(:catatan_backend, CatatanBackend.CassandraClient),
         :name,
         :xandra_connection
       )},
      {CatatanBackend.Email.Producer, %{queue_url: queue_url}},
      {CatatanBackend.Email.SQSPoller, %{queue_url: queue_url}},
      {CatatanBackend.Email.Process, %{queue_url: queue_url}},
      CatatanBackendWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: CatatanBackend.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    CatatanBackendWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
