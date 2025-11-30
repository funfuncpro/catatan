defmodule CatatanBackend.Notes.Crdt.Yata do
  @moduledoc """
  YATA (Yet Another Transformation Approach) is a CRDT for collaborative text editing.

  This implementation follows the YATA algorithm which ensures:
  - Convergence: All replicas reach the same state regardless of operation order
  - Intention preservation: Concurrent insertions are placed in a deterministic order

  The key insight of YATA is that each element stores its left neighbor (origin) and
  right neighbor (right_origin) at the time of insertion. When conflicts occur
  (multiple elements with the same origin), YATA uses a deterministic rule:
  elements are ordered by comparing their right_origins, with ties broken by ID.
  """

  alias CatatanBackend.Notes.Crdt.StateVector
  alias CatatanBackend.Notes.Crdt.Element

  @type t :: %__MODULE__{
          note_id: String.t(),
          site_id: String.t(),
          clock: integer(),
          elements: %{String.t() => Element.t()},
          state_vector: StateVector.t()
        }
  @derive Jason.Encoder
  defstruct [:note_id, :site_id, :clock, :elements, :state_vector]

  @spec initialize(String.t(), String.t()) :: t
  def initialize(note_id, site_id) do
    %__MODULE__{
      note_id: note_id,
      site_id: site_id,
      clock: 0,
      elements: %{},
      state_vector: StateVector.initialize()
    }
  end

  @spec increment_clock(t) :: t
  def increment_clock(%__MODULE__{} = yata) do
    %{yata | clock: yata.clock + 1}
  end

  @spec generate_id(t) :: {String.t(), integer()}
  def generate_id(%__MODULE__{} = yata) do
    {yata.site_id, yata.clock}
  end

  @spec insert(t, Element.id() | nil, Element.id() | nil, String.t()) :: {t, Element.t()}
  def insert(%__MODULE__{} = yata, origin, right_origin, content) do
    new_yata = increment_clock(yata)
    id = {new_yata.site_id, new_yata.clock}

    element = %Element{
      id: id,
      origin: origin,
      right_origin: right_origin,
      content: content,
      deleted_at: nil
    }

    element_key = Element.encode_id(element.id)
    state_vector = StateVector.update(new_yata.state_vector, new_yata.site_id, new_yata.clock)

    updated_yata = %{
      new_yata
      | elements: Map.put(new_yata.elements, element_key, element),
        state_vector: state_vector
    }

    {updated_yata, element}
  end

  @spec delete(t, String.t()) :: {t, Element.t()}
  def delete(%__MODULE__{} = yata, element_id) do
    element = Map.get(yata.elements, element_id)
    deleted_at = DateTime.utc_now() |> DateTime.to_iso8601()
    updated_element = %{element | deleted_at: deleted_at}
    updated_elements = Map.put(yata.elements, element_id, updated_element)
    updated_yata = %{yata | elements: updated_elements}
    {updated_yata, updated_element}
  end

  @doc """
  Integrates a remote element into the local YATA structure.

  This implements the YATA integration algorithm:
  1. If the element already exists, merge deletion timestamps
  2. Otherwise, add the element and update the state vector

  The actual ordering is computed lazily in to_list/1 using the compare function.
  """
  @spec integrate(t, Element.t()) :: t
  def integrate(%__MODULE__{} = yata, %Element{} = element) do
    element_key = Element.encode_id(element.id)
    {site_id, clock} = element.id

    if Map.has_key?(yata.elements, element_key) do
      existing = Map.get(yata.elements, element_key)
      merged = Element.merge_deleted(existing, element)
      %{yata | elements: Map.put(yata.elements, element_key, merged)}
    else
      %{
        yata
        | elements: Map.put(yata.elements, element_key, element),
          state_vector: StateVector.update(yata.state_vector, site_id, clock)
      }
    end
  end

  @doc """
  Returns all non-deleted elements in document order.

  Note: We must build the origin map from ALL elements (including deleted ones)
  to preserve the chain structure. Deleted elements are filtered out only after
  the traversal is complete.
  """
  @spec to_list(t) :: [Element.t()]
  def to_list(%__MODULE__{} = yata) do
    all_elements = Map.values(yata.elements)

    # Build origin map from ALL elements (including deleted) to preserve chain
    origin_map = build_origin_map(all_elements)

    heads = Map.get(origin_map, nil, [])
    sorted_heads = sort_conflicting(heads, yata.elements)

    # Build sorted list including deleted elements, then filter them out
    build_sorted_list(sorted_heads, origin_map, yata.elements, [])
    |> Enum.reject(&(&1.deleted_at != nil))
  end

  @doc """
  Returns the text content by concatenating all non-deleted elements in order.
  """
  @spec to_text(t) :: String.t()
  def to_text(%__MODULE__{} = yata) do
    yata
    |> to_list()
    |> Enum.map(& &1.content)
    |> Enum.join()
  end

  @doc """
  Sorts elements according to YATA ordering rules.

  The algorithm builds the document order by:
  1. Finding the head elements (those with nil origin)
  2. Recursively finding successors using origin chains
  3. Resolving conflicts when multiple elements share the same origin
  """
  @spec sort_elements([Element.t()], %{String.t() => Element.t()}) :: [Element.t()]
  def sort_elements(elements, all_elements) do
    origin_map = build_origin_map(elements)
    heads = Map.get(origin_map, nil, [])
    sorted_heads = sort_conflicting(heads, all_elements)
    build_sorted_list(sorted_heads, origin_map, all_elements, [])
  end

  defp build_origin_map(elements) do
    Enum.group_by(elements, fn el -> el.origin end)
  end

  defp build_sorted_list([], _origin_map, _all_elements, acc) do
    Enum.reverse(acc)
  end

  defp build_sorted_list([element | rest], origin_map, all_elements, acc) do
    children = Map.get(origin_map, element.id, [])
    sorted_children = sort_conflicting(children, all_elements)
    build_sorted_list(sorted_children ++ rest, origin_map, all_elements, [element | acc])
  end

  @doc """
  Sorts conflicting elements (elements with the same origin) using YATA rules.

  YATA conflict resolution:
  1. Compare right_origins: element with right_origin further right comes first
  2. If right_origins are equal or incomparable, use ID as tiebreaker
  """
  @spec sort_conflicting([Element.t()], %{String.t() => Element.t()}) :: [Element.t()]
  def sort_conflicting(elements, all_elements) do
    Enum.sort(elements, fn a, b ->
      compare_conflicting(a, b, all_elements)
    end)
  end

  # Compares two elements with the same origin
  defp compare_conflicting(%Element{} = a, %Element{} = b, all_elements) do
    cond do
      a.id == b.id ->
        true

      a.right_origin == b.id ->
        true

      b.right_origin == a.id ->
        false

      a.right_origin == nil and b.right_origin == nil ->
        compare_by_id(a.id, b.id)

      a.right_origin == nil ->
        false

      b.right_origin == nil ->
        true

      true ->
        compare_right_origins(a.right_origin, b.right_origin, all_elements)
    end
  end

  defp compare_right_origins(right_a, right_b, all_elements) do
    a_element = Map.get(all_elements, Element.encode_id(right_a))
    b_element = Map.get(all_elements, Element.encode_id(right_b))

    cond do
      a_element == nil or b_element == nil ->
        compare_by_id(right_a, right_b)

      reachable?(a_element, right_b, all_elements) ->
        true

      reachable?(b_element, right_a, all_elements) ->
        false

      true ->
        compare_by_id(right_a, right_b)
    end
  end

  defp reachable?(_element, nil, _all_elements), do: false

  defp reachable?(%Element{} = element, target_id, all_elements) do
    cond do
      element.id == target_id ->
        true

      element.right_origin == nil ->
        false

      element.right_origin == target_id ->
        true

      true ->
        next = Map.get(all_elements, Element.encode_id(element.right_origin))

        if next do
          reachable?(next, target_id, all_elements)
        else
          false
        end
    end
  end

  defp compare_by_id(nil, _), do: true
  defp compare_by_id(_, nil), do: false

  defp compare_by_id({site_a, clock_a}, {site_b, clock_b}) do
    cond do
      clock_a < clock_b -> true
      clock_a > clock_b -> false
      true -> site_a < site_b
    end
  end
end
