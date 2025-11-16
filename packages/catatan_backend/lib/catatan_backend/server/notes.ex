defmodule CatatanBackend.Server.Notes do
  @moduledoc """
  GenServer that manages a single note's state using CRDT semantics.

  Each note runs in its own process and maintains its state using
  Last-Write-Wins (LWW) conflict resolution.
  """

  use GenServer
  require Logger

  alias CatatanBackend.Notes.{NoteCrdt, Store}

  @type state :: %{
          note: NoteCrdt.t(),
          note_id: String.t(),
          replica_id: String.t()
        }

  @spec start_link(String.t()) :: GenServer.on_start()
  def start_link(note_id) do
    replica_id = Application.get_env(:catatan_backend, CatatanBackend.Replica)[:replica_id]

    GenServer.start_link(
      __MODULE__,
      {note_id, replica_id},
      name: via(note_id)
    )
  end

  @spec ensure_started(String.t()) :: :ok
  def ensure_started(note_id) do
    case start_link(note_id) do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
      {:error, _} -> :ok
    end
  end

  @spec set_body(String.t(), String.t()) :: :ok | {:error, term()}
  def set_body(note_id, markdown) do
    GenServer.call(via(note_id), {:set_body, markdown})
  end

  @spec read_body(String.t()) :: String.t()
  def read_body(note_id) do
    GenServer.call(via(note_id), :read_body)
  end

  @impl true
  def init({note_id, replica_id}) do
    note =
      Store.get(note_id)
      |> init_note(note_id, replica_id)

    {:ok, %{note: note, note_id: note_id, replica_id: replica_id}}
  end

  @impl true
  def handle_call(
        {:set_body, markdown},
        _from,
        %{note: note, note_id: note_id, replica_id: rid} = s
      ) do
    current_clock = NoteCrdt.current_clock(note)
    new_clock = current_clock + 1

    case NoteCrdt.set_body(note, rid, new_clock, markdown) do
      {:ok, updated_note} ->
        case Store.upsert(note_id, rid, new_clock, markdown) do
          {:ok, _stored_note} ->
            broadcast_updated(note_id, markdown, new_clock)
            {:reply, :ok, %{s | note: updated_note}}

          {:error, reason} ->
            Logger.error("Failed to persist note #{note_id}: #{inspect(reason)}")
            {:reply, {:error, {:persist_failed, reason}}, s}
        end

      {:error, :clock_regression} ->
        {:reply, {:error, :clock_regression}, s}
    end
  end

  @impl true
  def handle_call(:read_body, _from, %{note: note} = s) do
    body = NoteCrdt.get_body(note)
    {:reply, body, s}
  end

  @spec init_note({:ok, NoteCrdt.t()} | {:error, term()}, String.t(), String.t()) ::
          NoteCrdt.t()
  defp init_note({:ok, note}, note_id, _replica_id) do
    body = NoteCrdt.get_body(note)
    clock = NoteCrdt.current_clock(note)

    Logger.info(
      "Loaded note #{note_id} from database: clock=#{clock}, body_length=#{String.length(body)}"
    )

    note
  end

  defp init_note({:error, reason}, note_id, replica_id) do
    Logger.warning(
      "Failed to load note #{note_id} from database: #{inspect(reason)}. Creating new empty note."
    )

    NoteCrdt.new(note_id, replica_id)
  end

  defp via(note_id), do: {:via, Registry, {CatatanBackend.Notes.Registry, note_id}}

  @spec broadcast_updated(String.t(), String.t(), non_neg_integer()) :: :ok | {:error, term()}
  defp broadcast_updated(note_id, body, clock) do
    Phoenix.PubSub.broadcast(
      CatatanBackend.PubSub,
      "note:" <> note_id,
      {:note_updated, %{body: body, clock: clock}}
    )
  end
end
