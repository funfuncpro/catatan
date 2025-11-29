defmodule CatatanBackend.Notes.Store do
  @moduledoc """
  Internal module responsible for storing and retrieving notes from the database.
  """

  alias CatatanBackend.CassandraClient
  alias CatatanBackend.Encryption
  alias CatatanBackend.Notes.{Lww, NoteCrdt}

  require Logger

  @doc """
  This is an *upsert* operation: it overwrites existing note content.

  The body content is encrypted before being stored in Cassandra.
  Encrypted data is base64-encoded for storage in text columns.
  """
  @spec upsert(String.t(), term(), non_neg_integer(), String.t()) ::
          {:ok, NoteCrdt.t()} | {:error, term()}
  def upsert(note_id, replica_id, clock, body) do
    with {:ok, encrypted_body} <- encrypt_body(body),
         {:ok, prepared} <-
           CassandraClient.prepare(
             "INSERT INTO notes_lww (note_id, replica_id, clock, body) VALUES (:note_id, :replica_id, :clock, :body)"
           ),
         {:ok, _result} <-
           CassandraClient.execute(prepared, %{
             "note_id" => note_id,
             "replica_id" => to_string(replica_id),
             "clock" => clock,
             "body" => encrypted_body
           }) do
      lww = %Lww{
        content: body,
        clock: clock,
        replica_id: replica_id,
        last_updated: DateTime.utc_now()
      }

      note = %NoteCrdt{
        note_id: note_id,
        content: lww
      }

      {:ok, note}
    else
      {:error, :encryption_failed} = error ->
        Logger.error("Failed to encrypt note body for note_id=#{note_id}")
        error

      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  rescue
    exception ->
      {:error, {:exception, exception}}
  end

  @doc """
  Retrieve a note by note_id, merging all replicas.

  Returns the merged NoteCrdt from all replicas for the given note_id.
  """
  @spec get(String.t()) :: {:ok, NoteCrdt.t()} | {:error, term()}
  def get(note_id) do
    with {:ok, prepared} <-
           CassandraClient.prepare(
             "SELECT note_id, replica_id, clock, body FROM notes_lww WHERE note_id = :note_id"
           ),
         {:ok, %Xandra.Page{} = page} <-
           CassandraClient.execute(prepared, %{"note_id" => note_id}) do
      rows = Enum.to_list(page)

      if Enum.empty?(rows) do
        {:error, :not_found}
      else
        note = merge_replicas(note_id, rows)
        {:ok, note}
      end
    else
      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  rescue
    exception ->
      {:error, {:exception, exception}}
  end

  defp merge_replicas(note_id, replicas) do
    replicas
    |> Enum.map(&row_to_lww/1)
    |> Enum.reduce(&Lww.merge/2)
    |> then(fn merged_lww ->
      %NoteCrdt{
        note_id: note_id,
        content: merged_lww
      }
    end)
  end

  defp row_to_lww(row) do
    body = row["body"] || ""
    decrypted_body = decrypt_body(body)

    %Lww{
      content: decrypted_body,
      clock: row["clock"] || 0,
      replica_id: row["replica_id"] || "",
      last_updated: DateTime.utc_now()
    }
  end

  # Encryption/Decryption helpers

  @spec encrypt_body(String.t()) :: {:ok, String.t()} | {:error, :encryption_failed}
  defp encrypt_body(body) when is_binary(body) do
    case Encryption.encrypt(body) do
      {:ok, encrypted_binary} ->
        # Base64 encode for storage in Cassandra text column
        {:ok, Base.encode64(encrypted_binary)}

      {:error, _reason} ->
        {:error, :encryption_failed}
    end
  end

  @spec decrypt_body(String.t()) :: String.t()
  defp decrypt_body(encrypted_body) when is_binary(encrypted_body) do
    # Try to base64 decode and decrypt
    case Base.decode64(encrypted_body) do
      {:ok, encrypted_binary} ->
        case Encryption.decrypt(encrypted_binary) do
          {:ok, plaintext} ->
            plaintext

          {:error, reason} ->
            Logger.warning(
              "Failed to decrypt body (reason: #{inspect(reason)}), attempting to use as plaintext"
            )

            encrypted_body
        end

      :error ->
        # Not base64, might be plaintext from before encryption (backward compatibility)
        encrypted_body
    end
  end
end
