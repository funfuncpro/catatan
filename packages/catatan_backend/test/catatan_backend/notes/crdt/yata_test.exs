defmodule CatatanBackend.Notes.Crdt.YataTest do
  use ExUnit.Case, async: true

  alias CatatanBackend.Notes.Crdt.Yata
  alias CatatanBackend.Notes.Crdt.Element

  describe "initialize/2" do
    test "creates a new Yata instance" do
      yata = Yata.initialize("note-123", "site-abc")

      assert yata.note_id == "note-123"
      assert yata.site_id == "site-abc"
      assert yata.clock == 0
      assert yata.elements == %{}
      assert yata.state_vector == %{}
    end
  end

  describe "increment_clock/1" do
    test "increments the clock by 1" do
      yata = Yata.initialize("note-1", "site-1")
      assert yata.clock == 0

      yata = Yata.increment_clock(yata)
      assert yata.clock == 1

      yata = Yata.increment_clock(yata)
      assert yata.clock == 2
    end
  end

  describe "generate_id/1" do
    test "returns tuple of site_id and clock" do
      yata = Yata.initialize("note-1", "my-site")
      assert Yata.generate_id(yata) == {"my-site", 0}

      yata = Yata.increment_clock(yata)
      assert Yata.generate_id(yata) == {"my-site", 1}
    end
  end

  describe "insert/4" do
    test "inserts element at the beginning (nil origin)" do
      yata = Yata.initialize("note-1", "site-1")

      {yata, element} = Yata.insert(yata, nil, nil, "a")

      assert element.id == {"site-1", 1}
      assert element.origin == nil
      assert element.right_origin == nil
      assert element.content == "a"
      assert element.deleted_at == nil

      assert yata.clock == 1
      assert Map.has_key?(yata.elements, "site-1:1")
      assert yata.state_vector == %{"site-1" => 1}
    end

    test "inserts multiple elements sequentially" do
      yata = Yata.initialize("note-1", "site-1")

      {yata, el_a} = Yata.insert(yata, nil, nil, "a")
      {yata, el_b} = Yata.insert(yata, el_a.id, nil, "b")
      {yata, el_c} = Yata.insert(yata, el_b.id, nil, "c")

      assert el_a.id == {"site-1", 1}
      assert el_b.id == {"site-1", 2}
      assert el_c.id == {"site-1", 3}

      assert el_b.origin == {"site-1", 1}
      assert el_c.origin == {"site-1", 2}

      assert yata.clock == 3
      assert map_size(yata.elements) == 3
    end

    test "inserts element between two existing elements" do
      yata = Yata.initialize("note-1", "site-1")

      {yata, el_a} = Yata.insert(yata, nil, nil, "a")
      {yata, el_c} = Yata.insert(yata, el_a.id, nil, "c")
      {_yata, el_b} = Yata.insert(yata, el_a.id, el_c.id, "b")

      assert el_b.origin == el_a.id
      assert el_b.right_origin == el_c.id
    end
  end

  describe "delete/2" do
    test "marks an element as deleted" do
      yata = Yata.initialize("note-1", "site-1")
      {yata, element} = Yata.insert(yata, nil, nil, "a")

      element_key = Element.encode_id(element.id)
      {yata, deleted_element} = Yata.delete(yata, element_key)

      assert deleted_element.deleted_at != nil
      assert yata.elements[element_key].deleted_at != nil
    end
  end

  describe "integrate/2" do
    test "integrates a new remote element" do
      yata = Yata.initialize("note-1", "site-1")

      remote_element = %Element{
        id: {"site-2", 1},
        origin: nil,
        right_origin: nil,
        content: "x",
        deleted_at: nil
      }

      yata = Yata.integrate(yata, remote_element)

      assert Map.has_key?(yata.elements, "site-2:1")
      assert yata.state_vector["site-2"] == 1
    end

    test "merges deletion when element already exists" do
      yata = Yata.initialize("note-1", "site-1")
      {yata, element} = Yata.insert(yata, nil, nil, "a")

      # Simulate remote deletion of the same element
      remote_deleted = %Element{
        id: element.id,
        origin: nil,
        right_origin: nil,
        content: "a",
        deleted_at: "2025-01-01T00:00:00Z"
      }

      yata = Yata.integrate(yata, remote_deleted)
      element_key = Element.encode_id(element.id)

      assert yata.elements[element_key].deleted_at == "2025-01-01T00:00:00Z"
    end
  end

  describe "to_list/1" do
    test "returns empty list for empty yata" do
      yata = Yata.initialize("note-1", "site-1")
      assert Yata.to_list(yata) == []
    end

    test "returns elements in correct order" do
      yata = Yata.initialize("note-1", "site-1")

      {yata, el_a} = Yata.insert(yata, nil, nil, "a")
      {yata, el_b} = Yata.insert(yata, el_a.id, nil, "b")
      {yata, _el_c} = Yata.insert(yata, el_b.id, nil, "c")

      list = Yata.to_list(yata)

      assert length(list) == 3
      assert Enum.map(list, & &1.content) == ["a", "b", "c"]
    end

    test "excludes deleted elements" do
      yata = Yata.initialize("note-1", "site-1")

      {yata, el_a} = Yata.insert(yata, nil, nil, "a")
      {yata, el_b} = Yata.insert(yata, el_a.id, nil, "b")
      {yata, _el_c} = Yata.insert(yata, el_b.id, nil, "c")

      # Delete "b"
      {yata, _} = Yata.delete(yata, Element.encode_id(el_b.id))

      list = Yata.to_list(yata)

      assert length(list) == 2
      assert Enum.map(list, & &1.content) == ["a", "c"]
    end
  end

  describe "to_text/1" do
    test "returns empty string for empty yata" do
      yata = Yata.initialize("note-1", "site-1")
      assert Yata.to_text(yata) == ""
    end

    test "returns concatenated content" do
      yata = Yata.initialize("note-1", "site-1")

      {yata, el_a} = Yata.insert(yata, nil, nil, "H")
      {yata, el_b} = Yata.insert(yata, el_a.id, nil, "e")
      {yata, el_c} = Yata.insert(yata, el_b.id, nil, "l")
      {yata, el_d} = Yata.insert(yata, el_c.id, nil, "l")
      {yata, _el_e} = Yata.insert(yata, el_d.id, nil, "o")

      assert Yata.to_text(yata) == "Hello"
    end

    test "excludes deleted elements from text" do
      yata = Yata.initialize("note-1", "site-1")

      {yata, el_a} = Yata.insert(yata, nil, nil, "a")
      {yata, el_b} = Yata.insert(yata, el_a.id, nil, "X")
      {yata, _el_c} = Yata.insert(yata, el_b.id, nil, "c")

      {yata, _} = Yata.delete(yata, Element.encode_id(el_b.id))

      assert Yata.to_text(yata) == "ac"
    end
  end

  describe "concurrent insertions" do
    test "two users insert at same position - converges regardless of order" do
      # User A and User B both insert at the beginning
      yata_a = Yata.initialize("note-1", "site-a")
      yata_b = Yata.initialize("note-1", "site-b")

      # Both insert at the beginning (nil origin)
      {_yata_a, el_a} = Yata.insert(yata_a, nil, nil, "A")
      {_yata_b, el_b} = Yata.insert(yata_b, nil, nil, "B")

      # Integrate in order: A first, then B
      yata_1 = Yata.initialize("note-1", "site-1")
      yata_1 = Yata.integrate(yata_1, el_a)
      yata_1 = Yata.integrate(yata_1, el_b)

      # Integrate in reverse order: B first, then A
      yata_2 = Yata.initialize("note-1", "site-2")
      yata_2 = Yata.integrate(yata_2, el_b)
      yata_2 = Yata.integrate(yata_2, el_a)

      # Both should converge to the same text
      assert Yata.to_text(yata_1) == Yata.to_text(yata_2)
    end

    test "concurrent insertions after same origin - converges" do
      yata = Yata.initialize("note-1", "site-1")
      {yata, el_x} = Yata.insert(yata, nil, nil, "X")

      # User A inserts after X
      yata_a = yata
      {_yata_a, el_a} = Yata.insert(yata_a, el_x.id, nil, "A")

      # User B also inserts after X (different site)
      yata_b = %{yata | site_id: "site-b"}
      {_yata_b, el_b} = Yata.insert(yata_b, el_x.id, nil, "B")

      # Integrate both into a fresh replica
      replica = yata
      replica = Yata.integrate(replica, el_a)
      replica = Yata.integrate(replica, el_b)

      text = Yata.to_text(replica)

      # Both A and B should be in the text after X
      assert String.contains?(text, "X")
      assert String.contains?(text, "A")
      assert String.contains?(text, "B")
      assert String.starts_with?(text, "X")
    end

    test "interleaved typing from two users converges" do
      # Simulate two users typing "AB" and "12" respectively at the same position
      base = Yata.initialize("note-1", "site-base")

      # Site A types "A" then "B"
      site_a = %{base | site_id: "site-a"}
      {site_a, el_a1} = Yata.insert(site_a, nil, nil, "A")
      {_site_a, el_a2} = Yata.insert(site_a, el_a1.id, nil, "B")

      # Site B types "1" then "2" (also at beginning, concurrently)
      site_b = %{base | site_id: "site-b"}
      {site_b, el_b1} = Yata.insert(site_b, nil, nil, "1")
      {_site_b, el_b2} = Yata.insert(site_b, el_b1.id, nil, "2")

      # Replica 1: integrate A's ops, then B's ops
      r1 = base
      r1 = Yata.integrate(r1, el_a1)
      r1 = Yata.integrate(r1, el_a2)
      r1 = Yata.integrate(r1, el_b1)
      r1 = Yata.integrate(r1, el_b2)

      # Replica 2: integrate B's ops, then A's ops
      r2 = base
      r2 = Yata.integrate(r2, el_b1)
      r2 = Yata.integrate(r2, el_b2)
      r2 = Yata.integrate(r2, el_a1)
      r2 = Yata.integrate(r2, el_a2)

      # Replica 3: interleaved
      r3 = base
      r3 = Yata.integrate(r3, el_a1)
      r3 = Yata.integrate(r3, el_b1)
      r3 = Yata.integrate(r3, el_a2)
      r3 = Yata.integrate(r3, el_b2)

      # All replicas should converge to the same text
      text1 = Yata.to_text(r1)
      text2 = Yata.to_text(r2)
      text3 = Yata.to_text(r3)

      assert text1 == text2
      assert text2 == text3

      # All characters should be present
      assert String.length(text1) == 4
      assert String.contains?(text1, "A")
      assert String.contains?(text1, "B")
      assert String.contains?(text1, "1")
      assert String.contains?(text1, "2")
    end

    test "insertion with right_origin preserves position" do
      yata = Yata.initialize("note-1", "site-1")

      # Insert "a" and "c"
      {yata, el_a} = Yata.insert(yata, nil, nil, "a")
      {yata, el_c} = Yata.insert(yata, el_a.id, nil, "c")

      # Insert "b" between "a" and "c" with right_origin
      {yata, _el_b} = Yata.insert(yata, el_a.id, el_c.id, "b")

      assert Yata.to_text(yata) == "abc"
    end

    test "multiple insertions at same position with right_origin" do
      yata = Yata.initialize("note-1", "site-1")

      # Create "ac"
      {yata, el_a} = Yata.insert(yata, nil, nil, "a")
      {yata, el_c} = Yata.insert(yata, el_a.id, nil, "c")

      # Two different sites insert between "a" and "c"
      el_x = %Element{
        id: {"site-x", 1},
        origin: el_a.id,
        right_origin: el_c.id,
        content: "X",
        deleted_at: nil
      }

      el_y = %Element{
        id: {"site-y", 1},
        origin: el_a.id,
        right_origin: el_c.id,
        content: "Y",
        deleted_at: nil
      }

      # Integrate in both orders
      r1 = Yata.integrate(yata, el_x)
      r1 = Yata.integrate(r1, el_y)

      r2 = Yata.integrate(yata, el_y)
      r2 = Yata.integrate(r2, el_x)

      # Should converge
      assert Yata.to_text(r1) == Yata.to_text(r2)

      # Result should have all characters
      text = Yata.to_text(r1)
      assert String.starts_with?(text, "a")
      assert String.ends_with?(text, "c")
      assert String.contains?(text, "X")
      assert String.contains?(text, "Y")
    end
  end

  describe "sort_conflicting/2" do
    test "sorts elements with same origin by right_origin and id" do
      all_elements = %{}

      el_a = %Element{id: {"site-a", 1}, origin: nil, right_origin: nil, content: "A"}
      el_b = %Element{id: {"site-b", 1}, origin: nil, right_origin: nil, content: "B"}

      sorted = Yata.sort_conflicting([el_b, el_a], all_elements)

      # Should be deterministically sorted by ID when right_origins are equal
      ids = Enum.map(sorted, & &1.id)
      assert ids == [{"site-a", 1}, {"site-b", 1}]
    end
  end
end
