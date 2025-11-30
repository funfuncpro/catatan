defmodule CatatanBackend.Server.NotesNew do
  @moduledoc """
  GenServer that manages the CRDT state for a single note document.
  Handles insert, delete, and sync operations using YATA algorithm.

  This is separate from NotesSession which handles writers/cursors/presence.
  """

  use GenServer
  require Logger
  alias CatatanBackend.Notes.Crdt.{Yata, Element, Store, Sync}

  @spec start_link(String.t()) :: GenServer.on_start()
  def start_link(note_id) do
    GenServer.start_link(__MODULE__, note_id, name: via_tuple(note_id))
  end

  @doc """
  Inserts a new element into the CRDT.

  ## Parameters
    - note_id: The note identifier
    - origin: The left neighbor element ID (nil for start of document)
    - right_origin: The right neighbor element ID (nil for end of document)
    - content: The character/string to insert
    - writer_id: The writer's ID for generating unique element IDs
  """
  @spec insert(String.t(), Element.id() | nil, Element.id() | nil, String.t(), String.t()) ::
          {:ok, Element.t()} | {:error, term()}
  def insert(note_id, origin, right_origin, content, writer_id) do
    GenServer.call(via_tuple(note_id), {:insert, origin, right_origin, content, writer_id})
  end

  @doc """
  Marks an element as deleted (tombstone).

  ## Parameters
    - note_id: The note identifier
    - element_id: The encoded element ID (e.g., "writer_id:clock")
  """
  @spec delete(String.t(), String.t()) :: {:ok, Element.t()} | {:error, term()}
  def delete(note_id, element_id) do
    GenServer.call(via_tuple(note_id), {:delete, element_id})
  end

  @doc """
  Integrates a remote element into the local CRDT state.
  Used for applying operations from other clients.
  """
  @spec integrate(String.t(), Element.t()) :: :ok
  def integrate(note_id, element) do
    GenServer.cast(via_tuple(note_id), {:integrate, element})
  end

  @doc """
  Returns elements that the client hasn't seen based on their state vector.
  Used for syncing after reconnection.
  """
  @spec get_delta(String.t(), map()) :: {:ok, [Element.t()]}
  def get_delta(note_id, client_state_vector) do
    GenServer.call(via_tuple(note_id), {:get_delta, client_state_vector})
  end

  @doc """
  Returns the full YATA state.
  """
  @spec get_state(String.t()) :: {:ok, Yata.t()}
  def get_state(note_id) do
    GenServer.call(via_tuple(note_id), :get_state)
  end

  @doc """
  Returns the document text content.
  """
  @spec get_text(String.t()) :: {:ok, String.t()}
  def get_text(note_id) do
    GenServer.call(via_tuple(note_id), :get_text)
  end

  # --- Server Callbacks ---

  @impl true
  def init(note_id) do
    yata = load_or_initialize_yata(note_id)
    {:ok, %{note_id: note_id, yata: yata}}
  end

  @impl true
  def handle_call({:insert, origin, right_origin, content, writer_id}, _from, state) do
    yata_for_insert = %{state.yata | writer_id: writer_id}
    {updated_yata, element} = Yata.insert(yata_for_insert, origin, right_origin, content)

    element_with_note = %{element | note_id: state.note_id}

    case Store.save_element(element_with_note) do
      :ok ->
        broadcast_operation(state.note_id, {:insert, element_with_note})
        {:reply, {:ok, element_with_note}, %{state | yata: updated_yata}}

      {:error, reason} ->
        Logger.error("Failed to save element: #{inspect(reason)}")
        {:reply, {:error, reason}, state}
    end
  end

  @impl true
  def handle_call({:delete, element_id}, _from, state) do
    case Yata.delete(state.yata, element_id) do
      {:ok, updated_yata, deleted_element} ->
        deleted_at = DateTime.utc_now()

        case Store.mark_deleted(state.note_id, element_id, deleted_at) do
          :ok ->
            broadcast_operation(state.note_id, {:delete, element_id, deleted_at})
            {:reply, {:ok, deleted_element}, %{state | yata: updated_yata}}

          {:error, reason} ->
            Logger.error("Failed to mark element deleted: #{inspect(reason)}")
            {:reply, {:error, reason}, state}
        end

      {:error, :not_found} ->
        {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_call({:get_delta, client_state_vector}, _from, state) do
    delta = Sync.generate_delta(state.yata, client_state_vector)
    {:reply, {:ok, delta}, state}
  end

  @impl true
  def handle_call(:get_state, _from, state) do
    {:reply, {:ok, state.yata}, state}
  end

  @impl true
  def handle_call(:get_text, _from, state) do
    text = Yata.to_text(state.yata)
    {:reply, {:ok, text}, state}
  end

  @impl true
  def handle_cast({:integrate, element}, state) do
    updated_yata = Yata.integrate(state.yata, element)
    {:noreply, %{state | yata: updated_yata}}
  end

  defp load_or_initialize_yata(note_id) do
    case Store.load_elements(note_id) do
      {:ok, elements} when elements != [] ->
        Logger.info("Loading #{length(elements)} elements for note #{note_id}")
        yata = Yata.initialize(note_id, "server")
        Enum.reduce(elements, yata, &Yata.integrate(&2, &1))

      {:ok, []} ->
        Logger.info("Initializing new YATA for note #{note_id}")
        Yata.initialize(note_id, "server")

      {:error, reason} ->
        Logger.warning("Failed to load elements for note #{note_id}: #{inspect(reason)}")
        Yata.initialize(note_id, "server")
    end
  end

  defp broadcast_operation(note_id, operation) do
    topic = "notes:#{note_id}"
    Phoenix.PubSub.broadcast(CatatanBackend.PubSub, topic, {:crdt_operation, operation})
  end

  defp via_tuple(note_id) do
    {:via, Registry, {CatatanBackend.Registry, "crdt_#{note_id}"}}
  end
end
