defmodule CatatanBackendWeb.NotesSocket do
  use Phoenix.Socket
  require Logger
  alias CatatanBackend.OpenAuthClient
  alias CatatanBackend.Users

  channel "notes:*", CatatanBackendWeb.Channels.Notes

  @impl true
  def connect(params, socket, _connect_info) do
    socket =
      case Map.get(params, "token") do
        token when is_binary(token) and token != "" ->
          verify_user(socket, token)

        _ ->
          assign_anonymous(socket)
      end

    {:ok, socket}
  end

  defp verify_user(socket, token) do
    with {:ok, claims} <- OpenAuthClient.verify_token(token),
         {:ok, user_info} <- OpenAuthClient.extract_user_info(claims),
         {:ok, user_id} <- Users.upsert_user(user_info.email, user_info.external_id) do
      assign(socket, :current_user, %{
        user_id: user_id,
        email: user_info.email,
        external_id: user_info.external_id
      })
    else
      error ->
        Logger.warning("Socket auth failed: #{inspect(error)}")
        assign_anonymous(socket)
    end
  end

  defp assign_anonymous(socket) do
    assign(socket, :current_user, nil)
  end

  @impl true
  def id(_socket), do: nil
end
