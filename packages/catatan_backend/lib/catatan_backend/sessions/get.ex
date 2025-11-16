defmodule CatatanBackend.Sessions.Get do
  @moduledoc """
  Internal module responsible for retrieving sessions from the database.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Retrieves the note_id associated with a session_id.
  """
  @spec get_note_id_by_session(String.t()) :: {:ok, String.t()} | {:error, :not_found | term()}
  def get_note_id_by_session(session_id) do
    query = "SELECT note_id FROM sessions WHERE session_id = :session_id"
    params = %{"session_id" => session_id}

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, result} <- CassandraClient.execute(prepared, params) do
      rows = Enum.to_list(result)

      case rows do
        [] -> {:error, :not_found}
        [session] -> {:ok, Map.get(session, "note_id")}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Checks if a session exists.
  """
  @spec session_exists?(String.t()) :: {:ok, true} | {:error, :not_found | term()}
  def session_exists?(session_id) do
    case get_note_id_by_session(session_id) do
      {:ok, _note_id} -> {:ok, true}
      {:error, reason} -> {:error, reason}
    end
  end
end
