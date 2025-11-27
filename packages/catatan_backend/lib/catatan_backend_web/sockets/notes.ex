defmodule CatatanBackendWeb.NotesSocket do
  use Phoenix.Socket
  require Logger

  channel "notes:*", CatatanBackendWeb.Channels.Notes

  @impl true
  def connect(_params, socket, _connect_info) do
    Logger.debug("WebSocket connection established")
    {:ok, socket}
  end

  @impl true
  def id(_socket), do: nil
end
