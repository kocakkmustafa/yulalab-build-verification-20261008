"""Small temporary artifact fixtures; no build, live requests, or publication claim."""
import gzip
import hashlib
import importlib.util
import io
import json
import struct
import tarfile
import tempfile
import unittest
import zipfile
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("netlify_contract", Path(__file__).with_name("netlify-contract.py"))
contract = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(contract)
HANDLER = "___netlify-server-handler"
MIDDLEWARE = "___netlify-edge-handler-src-middleware"
EDGE = ".netlify/edge-functions-dist"
BUILD_ID = "fixture-build-20260908"
ERRORS = (ValueError, KeyError, TypeError, OSError, EOFError, tarfile.TarError, zipfile.BadZipFile)


def minimal_eszip():
    # One module, SHA-256 header/source sections, and an empty source-map section.
    # Fixtures exercise framing/integrity only, not execution by an ESZIP runtime.
    specifier = f"file:///root/{MIDDLEWARE}.js".encode()
    source = b"export default () => new Response('fixture');"
    header = struct.pack(">I", len(specifier)) + specifier + b"\0"
    header += struct.pack(">IIII", 0, len(source), 0, 0) + b"\0"
    sources = source + hashlib.sha256(source).digest()
    return (b"ESZIP_V2" + struct.pack(">I", len(header)) + header + hashlib.sha256(header).digest()
            + struct.pack(">I", len(sources)) + sources + struct.pack(">I", 0))


def minimal_tar(name=f"./{MIDDLEWARE}.js", link=False):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w") as archive:
        member = tarfile.TarInfo(name)
        if link:
            member.type = tarfile.SYMTYPE
            member.linkname = "../outside"
            archive.addfile(member)
        else:
            payload = b"export default () => new Response('fixture');"
            member.size = len(payload)
            archive.addfile(member, io.BytesIO(payload))
    return gzip.compress(output.getvalue(), mtime=0)


class ArtifactContractTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="yula-netlify-contract-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.write("netlify.toml", '''[build]
command = "pnpm build"
publish = ".next"
[build.environment]
NODE_VERSION = "26.9.0"
PNPM_VERSION = "10.33.0"
[[plugins]]
package = "@netlify/plugin-nextjs"
[[headers]]
for = "/portfolio-registry.json"
[headers.values]
Access-Control-Allow-Origin = "https://links.yulalab.com"
Access-Control-Allow-Methods = "GET"
Cache-Control = "public, max-age=300, must-revalidate"
''')
        self.write_json("package.json", {"devDependencies": {"@netlify/plugin-nextjs": "5.15.13"}})
        self.write("pnpm-lock.yaml", "fixture lock\n")
        self.write(".next/BUILD_ID", BUILD_ID)
        self.write(".next/prerender-manifest.json", "{}")
        self.write(f".netlify/functions-internal/{HANDLER}/.next/BUILD_ID", BUILD_ID)
        self.write("public/portfolio-registry.json", '{"fixture":true}')
        self.write(".netlify/static/portfolio-registry.json", '{"fixture":true}')
        self.zip_relative = f".netlify/functions/{HANDLER}.zip"
        self.write(self.zip_relative, b"")
        self.make_zip()
        self.functions = {"functions": [{"name": HANDLER, "generator": "@netlify/plugin-nextjs@5.15.13",
                                        "runtimeVersion": "nodejs24.x", "path": str(self.root / self.zip_relative)}],
                          "system": {"arch": "fixture", "platform": "fixture"}}
        self.write_json(".netlify/functions/manifest.json", self.functions)
        self.edge = {"bundles": [self.asset("eszip2", minimal_eszip())],
                     "routes": [{"function": MIDDLEWARE,
                                 "pattern": r"^(?:/(_next/data/[^/]{1,}))?(?:/((?!api|_next|_vercel|.*\..*).*))" r"(\.json|\.rsc|\.segments/.+\.segment\.rsc)?[/#\?]?$",
                                 "excluded_patterns": []}], "post_cache_routes": [],
                     "function_config": {MIDDLEWARE: {"name": "Next.js Middleware Handler", "generator": "@netlify/plugin-nextjs@5.15.13"}}}
        self.write_json(f"{EDGE}/manifest.json", self.edge)

    def write(self, relative, contents):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(contents.encode() if isinstance(contents, str) else contents)

    def write_json(self, relative, contents):
        self.write(relative, json.dumps(contents))

    def asset(self, format_name, data):
        extension = "eszip" if format_name == "eszip2" else "tar.gz"
        name = f"{hashlib.sha256(data).hexdigest()}.{extension}"
        self.write(f"{EDGE}/{name}", data)
        return {"asset": name, "format": format_name}

    def make_zip(self, build_id=BUILD_ID):
        with zipfile.ZipFile(self.root / self.zip_relative, "w") as archive:
            archive.writestr(".next/BUILD_ID", build_id)

    def rejected(self):
        with self.assertRaises(ERRORS):
            contract.validate(self.root)

    def test_single_and_dual_formats_in_either_order(self):
        tar = self.asset("tar", minimal_tar())
        eszip = self.edge["bundles"][0]
        for bundles in ([eszip], [tar, eszip], [eszip, tar]):
            with self.subTest(formats=[b["format"] for b in bundles]):
                self.edge["bundles"] = bundles
                self.write_json(f"{EDGE}/manifest.json", self.edge)
                result = contract.validate(self.root)
                self.assertEqual(result["status"], "PASS")
                self.assertEqual(result["buildId"], BUILD_ID)
                self.assertEqual(result["functionSystem"], {"arch": "fixture", "platform": "fixture"})
                self.assertEqual(result["edgeFormats"], sorted(b["format"] for b in bundles))
                self.assertEqual(len(result["files"]), 8 + len(bundles))

    def test_unsupported_missing_and_duplicate_bundle_formats(self):
        eszip = self.edge["bundles"][0]
        tar = self.asset("tar", minimal_tar())
        cases = [[], [tar], [eszip, eszip], [eszip, tar, tar],
                 [{**eszip, "format": "javascript"}], [{"asset": eszip["asset"]}]]
        for bundles in cases:
            with self.subTest(bundles=bundles):
                self.edge["bundles"] = bundles
                self.write_json(f"{EDGE}/manifest.json", self.edge)
                self.rejected()

    def test_route_and_middleware_identity_are_not_relaxed(self):
        route = self.edge["routes"][0]
        cases = [{"routes": []}, {"routes": [route, route]},
                 {"routes": [{**route, "function": "other"}]},
                 {"routes": [{**route, "pattern": ".*"}]},
                 {"post_cache_routes": [route]}, {"function_config": {}},
                 {"function_config": {MIDDLEWARE: {"name": "Next.js Middleware Handler", "generator": "other"}}},
                 {"function_config": {MIDDLEWARE: {"name": "Next.js Middleware Handler"}}}]
        for change in cases:
            with self.subTest(change=change):
                self.write_json(f"{EDGE}/manifest.json", {**self.edge, **change})
                self.rejected()

    def test_server_identity_count_runtime_and_package_path(self):
        handler = self.functions["functions"][0]
        cases = [[], [handler, handler], [{**handler, "name": "other"}],
                 [{**handler, "generator": "other"}], [{**handler, "runtimeVersion": "nodejs20.x"}],
                 [{**handler, "runtimeVersion": "nodejs22.x"}], [{**handler, "runtimeVersion": "nodejs26.x"}],
                 [{key: value for key, value in handler.items() if key != "runtimeVersion"}],
                 [{**handler, "path": "/outside/server.zip"}],
                 [{key: value for key, value in handler.items() if key != "generator"}]]
        for functions in cases:
            with self.subTest(functions=functions):
                self.write_json(".netlify/functions/manifest.json", {**self.functions, "functions": functions})
                self.rejected()

    def test_missing_and_unsafe_asset_paths(self):
        original = self.edge["bundles"][0]
        for name in ("missing.eszip", "../outside.eszip", "/outside.eszip", "folder/asset.eszip",
                     original["asset"].replace(".eszip", ".tar.gz"), "0" * 64 + ".eszip"):
            with self.subTest(name=name):
                self.edge["bundles"] = [{**original, "asset": name}]
                self.write_json(f"{EDGE}/manifest.json", self.edge)
                self.rejected()

    def test_disk_file_and_parent_symlinks_are_rejected(self):
        asset = self.root / EDGE / self.edge["bundles"][0]["asset"]
        target = self.root / "fixture-target"
        target.write_bytes(asset.read_bytes())
        asset.unlink()
        asset.symlink_to(target)
        self.rejected()
        asset.unlink()
        asset.write_bytes(target.read_bytes())
        directory = self.root / EDGE
        moved = self.root / "fixture-edge-directory"
        directory.rename(moved)
        directory.symlink_to(moved, target_is_directory=True)
        self.rejected()

    def test_asset_hash_mismatch_and_zero_bytes(self):
        asset = self.root / EDGE / self.edge["bundles"][0]["asset"]
        for contents in (b"", b"corrupted"):
            with self.subTest(contents=contents):
                asset.write_bytes(contents)
                self.rejected()

    def test_rehashed_short_truncated_and_corrupt_eszip(self):
        data = minimal_eszip()
        # Renaming to the changed SHA ensures framing is checked after file hashing.
        cases = [b"", b"ESZIP_V2", b"NOTESZIP" + data[8:], data[:-1],
                 data[:16], data + b"trailing", data[:8] + b"\xff\xff\xff\xff" + data[12:]]
        header_length = int.from_bytes(data[8:12], "big")
        broken_checksum = bytearray(data)
        broken_checksum[12 + header_length] ^= 1
        cases.append(bytes(broken_checksum))
        for contents in cases:
            with self.subTest(length=len(contents)):
                self.edge["bundles"] = [self.asset("eszip2", contents)]
                self.write_json(f"{EDGE}/manifest.json", self.edge)
                self.rejected()

    def test_rehashed_truncated_tar_and_unsafe_members(self):
        data = minimal_tar()
        cases = [data[:-5], b"not gzip", minimal_tar("../escape.js"), minimal_tar("/escape.js"),
                 minimal_tar(link=True), minimal_tar("unrelated.js")]
        eszip = self.edge["bundles"][0]
        for contents in cases:
            with self.subTest(length=len(contents)):
                self.edge["bundles"] = [eszip, self.asset("tar", contents)]
                self.write_json(f"{EDGE}/manifest.json", self.edge)
                self.rejected()

    def test_tar_middleware_directory_is_not_a_file(self):
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode="w") as archive:
            member = tarfile.TarInfo(f"./{MIDDLEWARE}.js/")
            member.type = tarfile.DIRTYPE
            archive.addfile(member)
        self.edge["bundles"].append(self.asset("tar", gzip.compress(output.getvalue(), mtime=0)))
        self.write_json(f"{EDGE}/manifest.json", self.edge)
        with self.assertRaisesRegex(contract.ContractError, "tar middleware entry missing"):
            contract.validate(self.root)

    def test_server_zip_truncation_and_wrong_build(self):
        path = self.root / self.zip_relative
        path.write_bytes(path.read_bytes()[:-8])
        self.rejected()
        self.make_zip("another-build")
        self.rejected()

    def test_existing_source_config_guards(self):
        path = self.root / "netlify.toml"
        original = path.read_text()
        for old, new in (("pnpm build", "echo skipped"), ('publish = ".next"', 'publish = "public"'),
                         ("26.9.0", "20.0.0"), ("10.33.0", "9.0.0"),
                         ('package = "@netlify/plugin-nextjs"', 'package = "other"'),
                         ("https://links.yulalab.com", "*")):
            with self.subTest(setting=old):
                path.write_text(original.replace(old, new))
                self.rejected()
        path.write_text(original)
        self.write_json("package.json", {"devDependencies": {"@netlify/plugin-nextjs": "0.0.0"}})
        self.rejected()

    def test_existing_registry_and_build_identity_guards(self):
        cases = [(".next/BUILD_ID", "short"),
                 (f".netlify/functions-internal/{HANDLER}/.next/BUILD_ID", "other-build"),
                 (".netlify/static/portfolio-registry.json", "different registry")]
        for relative, contents in cases:
            with self.subTest(path=relative):
                path = self.root / relative
                original = path.read_bytes()
                path.write_text(contents)
                self.rejected()
                path.write_bytes(original)


if __name__ == "__main__":
    unittest.main(verbosity=2)
