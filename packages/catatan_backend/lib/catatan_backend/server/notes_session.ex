defmodule CatatanBackend.Server.NotesSession do
  @moduledoc """
  GenServer that manages a single notes session to track user, cursor
  """

  use GenServer
  require Logger
  alias CatatanBackend.Actor.Writer
  alias CatatanBackend.Cursor

  @tick_interval_ms 200

  @doc """
  Starts the Session Server for a specific Note ID.
  We use the Registry to ensure we can find this specific process later.
  """
  @spec start_link(String.t()) :: GenServer.on_start()
  def start_link(note_id) do
    name = via_tuple(note_id)
    GenServer.start_link(__MODULE__, note_id, name: name)
  end

  @impl true
  def init(note_id) do
    schedule_tick()

    state = %{
      note_id: note_id,
      writers: %{},
      dirty: false
    }

    {:ok, state}
  end

  @doc """
  Called when a user connects via WebSocket.
  Returns {:ok, writer, writers_map} so the frontend can init with O(1) lookup.
  """
  @spec join(String.t(), Writer.user_profile() | nil) ::
          {:ok, Writer.t(), %{String.t() => Writer.t()}}
  def join(note_id, user_profile) do
    GenServer.call(via_tuple(note_id), {:join, user_profile})
  end

  @doc """
  Called when the frontend sends a cursor update.
  Uses YATA element references for cursor positioning.
  """
  @spec update_cursor(String.t(), String.t(), Cursor.element_id(), non_neg_integer()) :: :ok
  def update_cursor(note_id, user_id, after_element, offset \\ 0) do
    GenServer.cast(via_tuple(note_id), {:move, user_id, after_element, offset})
  end

  @doc """
  Called when the socket disconnects.
  """
  @spec leave(String.t(), String.t()) :: :ok
  def leave(note_id, user_id) do
    GenServer.cast(via_tuple(note_id), {:leave, user_id})
  end

  @impl true
  def handle_call({:join, nil}, _from, state) do
    new_writer = Writer.initialize_actor()
    new_writers = Map.put(state.writers, new_writer.id, new_writer)

    broadcast_state(state.note_id, new_writers)
    new_state = %{state | writers: new_writers, dirty: false}
    {:reply, {:ok, new_writer, new_writers}, new_state}
  end

  @impl true
  def handle_call({:join, user_profile}, _from, state) do
    new_writer = Writer.initialize_actor(user_profile)
    new_writers = Map.put(state.writers, new_writer.id, new_writer)

    broadcast_state(state.note_id, new_writers)
    new_state = %{state | writers: new_writers, dirty: false}
    {:reply, {:ok, new_writer, new_writers}, new_state}
  end

  @impl true
  def handle_cast({:move, user_id, after_element, offset}, state) do
    case Map.get(state.writers, user_id) do
      nil ->
        {:noreply, state}

      writer ->
        updated_writer = Writer.update_cursor_position(writer, after_element, offset)
        new_writers = Map.put(state.writers, user_id, updated_writer)
        {:noreply, %{state | writers: new_writers, dirty: true}}
    end
  end

  @impl true
  def handle_cast({:leave, user_id}, state) do
    if Map.has_key?(state.writers, user_id) do
      new_writers = Map.delete(state.writers, user_id)
      new_state = %{state | writers: new_writers, dirty: true}

      if map_size(new_writers) == 0 do
        {:stop, :normal, new_state}
      else
        {:noreply, new_state}
      end
    else
      {:noreply, state}
    end
  end

  @impl true
  def handle_info(:tick, state) do
    if state.dirty do
      broadcast_state(state.note_id, state.writers)
    end

    schedule_tick()

    {:noreply, %{state | dirty: false}}
  end

  defp broadcast_state(note_id, writers_map) do
    topic = "notes:#{note_id}"

    payload = %{
      event: "presence_state",
      writers: writers_map
    }

    Phoenix.PubSub.broadcast(CatatanBackend.PubSub, topic, {:presence_state, payload})
  end

  defp via_tuple(note_id), do: {:via, Registry, {CatatanBackend.Registry, "session_#{note_id}"}}
  defp schedule_tick, do: Process.send_after(self(), :tick, @tick_interval_ms)
end
