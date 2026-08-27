#!/bin/bash
cat src/types/index.ts | grep -n "studentNotes?: Record<string, string>;"
