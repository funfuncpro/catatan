defmodule CatatanBackend.Notes.Crdt.ElementTest do
  use ExUnit.Case, async: true

  alias CatatanBackend.Notes.Crdt.Element

  describe "parse/1" do
    test "parses a valid element from JSON-like map" do
      input = %{
        "id" => ["writer1", 1],
        "origin" => ["writer1", 0],
        "right_origin" => ["writer2", 2],
        "content" => "a"
      }

      assert {:ok, element} = Element.parse(input)
      assert element.id == {"writer1", 1}
      assert element.origin == {"writer1", 0}
      assert element.right_origin == {"writer2", 2}
      assert element.content == "a"
      assert element.deleted_at == nil
    end

    test "parses element with nil origin and right_origin" do
      input = %{
        "id" => ["writer1", 1],
        "origin" => nil,
        "right_origin" => nil,
        "content" => "x"
      }

      assert {:ok, element} = Element.parse(input)
      assert element.id == {"writer1", 1}
      assert element.origin == nil
      assert element.right_origin == nil
      assert element.content == "x"
    end

    test "returns error for invalid format" do
      assert {:error, "Invalid element format"} = Element.parse(%{})
      assert {:error, "Invalid element format"} = Element.parse(%{"id" => ["writer1", 1]})
      assert {:error, "Invalid element format"} = Element.parse("not a map")
    end
  end

  describe "encode_id/1" do
    test "encodes a tuple id to string" do
      assert Element.encode_id({"writer1", 42}) == "writer1:42"
      assert Element.encode_id({"user-abc", 0}) == "user-abc:0"
    end

    test "returns nil for nil input" do
      assert Element.encode_id(nil) == nil
    end
  end

  describe "decode_id/1" do
    test "decodes a string id to tuple" do
      assert Element.decode_id("writer1:42") == {"writer1", 42}
      assert Element.decode_id("user-abc:0") == {"user-abc", 0}
    end

    test "returns nil for nil input" do
      assert Element.decode_id(nil) == nil
    end
  end

  describe "encode_id/1 and decode_id/1 roundtrip" do
    test "roundtrip preserves the id" do
      id = {"my-writer", 123}
      assert id == id |> Element.encode_id() |> Element.decode_id()
    end
  end

  describe "merge_deleted/2" do
    test "returns nil when both have nil deleted_at" do
      existing = %Element{id: {"a", 1}, deleted_at: nil, content: "x"}
      incoming = %Element{id: {"a", 1}, deleted_at: nil, content: "x"}

      result = Element.merge_deleted(existing, incoming)
      assert result.deleted_at == nil
    end

    test "takes incoming deleted_at when existing is nil" do
      existing = %Element{id: {"a", 1}, deleted_at: nil, content: "x"}
      incoming = %Element{id: {"a", 1}, deleted_at: "2025-01-01T00:00:00Z", content: "x"}

      result = Element.merge_deleted(existing, incoming)
      assert result.deleted_at == "2025-01-01T00:00:00Z"
    end

    test "keeps existing deleted_at when incoming is nil" do
      existing = %Element{id: {"a", 1}, deleted_at: "2025-01-01T00:00:00Z", content: "x"}
      incoming = %Element{id: {"a", 1}, deleted_at: nil, content: "x"}

      result = Element.merge_deleted(existing, incoming)
      assert result.deleted_at == "2025-01-01T00:00:00Z"
    end

    test "takes the earlier timestamp when both have deleted_at" do
      existing = %Element{id: {"a", 1}, deleted_at: "2025-01-02T00:00:00Z", content: "x"}
      incoming = %Element{id: {"a", 1}, deleted_at: "2025-01-01T00:00:00Z", content: "x"}

      result = Element.merge_deleted(existing, incoming)
      assert result.deleted_at == "2025-01-01T00:00:00Z"
    end

    test "takes the earlier timestamp (reverse order)" do
      existing = %Element{id: {"a", 1}, deleted_at: "2025-01-01T00:00:00Z", content: "x"}
      incoming = %Element{id: {"a", 1}, deleted_at: "2025-01-02T00:00:00Z", content: "x"}

      result = Element.merge_deleted(existing, incoming)
      assert result.deleted_at == "2025-01-01T00:00:00Z"
    end
  end
end
