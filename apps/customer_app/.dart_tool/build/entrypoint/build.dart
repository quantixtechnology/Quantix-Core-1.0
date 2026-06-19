// @dart=3.6
// ignore_for_file: type=lint
// build_runner >=2.4.16
import 'dart:io' as _io;
import 'package:build_runner/src/build_plan/builder_factories.dart'
    as _build_runner;
import 'package:build_runner/src/bootstrap/processes.dart' as _build_runner;
import 'package:freezed/builder.dart' as _i1;
import 'package:json_serializable/builder.dart' as _i2;
import 'package:mockito/src/builder.dart' as _i3;
import 'package:riverpod_generator/builder.dart' as _i4;
import 'package:source_gen/builder.dart' as _i5;

final _builderFactories = _build_runner.BuilderFactories(
  {
    'freezed:freezed': [_i1.freezed],
    'json_serializable:json_serializable': [_i2.jsonSerializable],
    'mockito:mockBuilder': [_i3.buildMocks],
    'riverpod_generator:riverpod_generator': [_i4.riverpodBuilder],
    'source_gen:combining_builder': [_i5.combiningBuilder],
  },
  postProcessBuilderFactories: {
    'source_gen:part_cleanup': _i5.partCleanup,
  },
);
void main(List<String> args) async {
  _io.exitCode = await _build_runner.ChildProcess.run(
    args,
    _builderFactories,
  )!;
}
